-- Reduce avoidable Vercel work without weakening game-integrity checks.

-- Track the last dispatch on the Bowl season row so Supabase can retain a
-- frequent, cheap gate while Vercel is called only at the season's needed pace.
alter table public.bowl_pool_seasons
  add column if not exists last_sync_dispatched_at timestamptz;

-- The line-lock dispatch gate must also run the endpoint whenever there are
-- disrupted pending picks. lockDueLines() calls void_disrupted_picks() before
-- looking for line work, and this condition preserves that integrity path.
create or replace function public.line_lock_work_is_due()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    exists (
      select 1
      from public.games game
      where game.status = 'scheduled'
        and game.line_lock_at <= statement_timestamp()
        and game.kickoff_at > statement_timestamp()
        and not exists (
          select 1 from public.game_lines line where line.game_id = game.id
        )
    )
    or exists (
      select 1
      from public.picks pick
      join public.games game on game.id = pick.game_id
      join public.scoring_periods period on period.id = pick.scoring_period_id
      where pick.result = 'pending'
        and game.status in ('postponed', 'cancelled', 'no_contest')
        and period.status <> 'complete'
    )
    or exists (
      select 1
      from public.survivor_picks pick
      join public.games game on game.id = pick.game_id
      join public.scoring_periods period on period.id = pick.scoring_period_id
      where pick.result = 'pending'
        and game.status in ('postponed', 'cancelled', 'no_contest')
        and period.status <> 'complete'
    );
$$;

create or replace function public.dispatch_line_lock_if_due()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, net, vault
as $$
declare
  shared_secret text;
  request_id bigint;
begin
  if not public.line_lock_work_is_due() then return false; end if;
  select decrypted_secret into shared_secret
  from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if coalesce(shared_secret, '') = '' then raise exception 'The automation secret is missing.'; end if;
  request_id := net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/lock-lines',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || shared_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  return request_id is not null;
end;
$$;

-- Bowl cadence is based on the actual schedule: daily in the off-season,
-- hourly during the 30-day ramp-up, and every 15 minutes while games remain
-- active. The lightweight pg_cron gate runs every 15 minutes; this dispatcher
-- persists its last Vercel dispatch on the season row.
create or replace function public.dispatch_bowl_sync_if_due()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, net, vault
as $$
declare
  season_year_value integer := extract(year from (clock_timestamp() at time zone 'UTC'))::integer;
  season_month integer := extract(month from (clock_timestamp() at time zone 'UTC'))::integer;
  season_row public.bowl_pool_seasons%rowtype;
  has_active_games boolean := false;
  min_interval interval;
  shared_secret text;
  request_id bigint;
  evaluated_at timestamptz := clock_timestamp();
begin
  if season_month < 8 then season_year_value := season_year_value - 1; end if;
  if not pg_try_advisory_xact_lock(7026, 928) then return false; end if;

  insert into public.bowl_pool_seasons (season_year, player_visible_at)
  values (season_year_value, make_timestamptz(season_year_value, 12, 7, 8, 0, 0, 'UTC'))
  on conflict (season_year) do nothing;

  select * into season_row from public.bowl_pool_seasons
  where season_year = season_year_value for update;
  select exists (
    select 1 from public.bowl_pool_games
    where season_id = season_row.id and status in ('scheduled', 'live')
  ) into has_active_games;

  if season_row.status = 'complete' or season_row.first_kickoff_at is null then
    min_interval := interval '24 hours';
  elsif season_row.first_kickoff_at > evaluated_at then
    min_interval := case
      when season_row.first_kickoff_at <= evaluated_at + interval '30 days' then interval '1 hour'
      else interval '24 hours'
    end;
  elsif has_active_games then
    min_interval := interval '15 minutes';
  else
    min_interval := interval '24 hours';
  end if;

  if season_row.last_sync_dispatched_at is not null
    and season_row.last_sync_dispatched_at > evaluated_at - min_interval then
    return false;
  end if;

  select decrypted_secret into shared_secret
  from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if coalesce(shared_secret, '') = '' then raise exception 'The automation secret is missing.'; end if;
  request_id := net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/sync-bowl-scores',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || shared_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  if request_id is null then return false; end if;
  update public.bowl_pool_seasons set last_sync_dispatched_at = evaluated_at where id = season_row.id;
  return true;
end;
$$;

revoke all on function public.line_lock_work_is_due() from public, anon, authenticated;
revoke all on function public.dispatch_line_lock_if_due() from public, anon, authenticated;
revoke all on function public.dispatch_bowl_sync_if_due() from public, anon, authenticated;
grant execute on function public.line_lock_work_is_due() to service_role;
grant execute on function public.dispatch_line_lock_if_due() to service_role;
grant execute on function public.dispatch_bowl_sync_if_due() to service_role;

-- Add a separately leased worker for future-email reconciliation.
alter table public.automation_execution_leases
  drop constraint if exists automation_execution_leases_job_name_check;
alter table public.automation_execution_leases
  add constraint automation_execution_leases_job_name_check
  check (job_name in ('line_locks', 'scores', 'bowl_scores', 'reminders', 'reminder_schedule', 'season_bootstrap', 'watchdog', 'schedule_refresh'));

create or replace function public.claim_automation_execution_lease(target_job_name text, lease_seconds integer default 120)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_token uuid := gen_random_uuid(); acquired_token uuid;
begin
  if target_job_name not in ('line_locks', 'scores', 'bowl_scores', 'reminders', 'reminder_schedule', 'season_bootstrap', 'watchdog', 'schedule_refresh')
    or lease_seconds not between 30 and 600 then
    raise exception 'Invalid automation lease request.';
  end if;
  insert into public.automation_execution_leases(job_name, token, acquired_at, locked_until)
  values (target_job_name, new_token, clock_timestamp(), clock_timestamp() + make_interval(secs => lease_seconds))
  on conflict (job_name) do update set token = excluded.token, acquired_at = excluded.acquired_at, locked_until = excluded.locked_until
  where public.automation_execution_leases.locked_until <= clock_timestamp()
  returning token into acquired_token;
  return acquired_token;
end;
$$;

alter table public.automation_worker_heartbeats
  drop constraint if exists automation_worker_heartbeats_job_name_check;
alter table public.automation_worker_heartbeats
  add constraint automation_worker_heartbeats_job_name_check
  check (job_name in ('line_locks', 'scores', 'bowl_scores', 'reminders', 'reminder_schedule', 'season_bootstrap', 'watchdog', 'schedule_refresh'));

create or replace function public.record_automation_worker_heartbeat(target_job_name text, target_status text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare recorded_at timestamptz := clock_timestamp();
begin
  if target_job_name not in ('line_locks', 'scores', 'bowl_scores', 'reminders', 'reminder_schedule', 'season_bootstrap', 'watchdog', 'schedule_refresh')
    or target_status not in ('started', 'success', 'failed', 'skipped') then
    raise exception 'Invalid automation heartbeat.';
  end if;
  insert into public.automation_worker_heartbeats(job_name,last_status,last_started_at,last_succeeded_at,last_failed_at,updated_at)
  values(target_job_name,target_status,recorded_at,case when target_status='success' then recorded_at end,case when target_status='failed' then recorded_at end,recorded_at)
  on conflict (job_name) do update set
    last_status=excluded.last_status,
    last_started_at=case when target_status='started' then recorded_at else public.automation_worker_heartbeats.last_started_at end,
    last_succeeded_at=case when target_status='success' then recorded_at else public.automation_worker_heartbeats.last_succeeded_at end,
    last_failed_at=case when target_status='failed' then recorded_at else public.automation_worker_heartbeats.last_failed_at end,
    updated_at=recorded_at;
end;
$$;

revoke all on function public.claim_automation_execution_lease(text, integer) from public, anon, authenticated;
grant execute on function public.claim_automation_execution_lease(text, integer) to service_role;
revoke all on function public.record_automation_worker_heartbeat(text, text) from public, anon, authenticated;
grant execute on function public.record_automation_worker_heartbeat(text, text) to service_role;

-- Replace the direct line-lock and Bowl requests with database-side gates,
-- and keep delivery fast while reconciling future email schedules every 15m.
do $migration$
declare
  job record;
begin
  for job in select jobid from cron.job where jobname in (
    'lock-official-lines-every-minute',
    'refresh-bowl-pool-every-fifteen-minutes',
    'reconcile-pickem-email-schedule-every-fifteen-minutes'
  ) loop
    if to_regprocedure('cron.unschedule(integer)') is not null then
      perform cron.unschedule(job.jobid::integer);
    elsif to_regprocedure('cron.unschedule(bigint)') is not null then
      perform cron.unschedule(job.jobid);
    end if;
  end loop;

  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('lock-official-lines-every-minute', '* * * * *', 'select public.dispatch_line_lock_if_due();');
    perform cron.schedule('refresh-bowl-pool-every-fifteen-minutes', '*/15 * * * *', 'select public.dispatch_bowl_sync_if_due();');
    perform cron.schedule('reconcile-pickem-email-schedule-every-fifteen-minutes', '*/15 * * * *', $job$select net.http_post(
      url := 'https://pickemjb.vercel.app/api/cron/maintain-reminders',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1
      )),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );$job$);
  elsif to_regprocedure('cron.schedule(text,text)') is not null then
    perform cron.schedule('* * * * *', 'select public.dispatch_line_lock_if_due();');
    perform cron.schedule('*/15 * * * *', 'select public.dispatch_bowl_sync_if_due();');
    perform cron.schedule('*/15 * * * *', $job$select net.http_post(
      url := 'https://pickemjb.vercel.app/api/cron/maintain-reminders',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1
      )),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );$job$);
  end if;
end
$migration$;

-- Keep commissioner preflight aligned with the gated dispatchers and the new
-- maintenance worker, while validating secrets in helper bodies where needed.
create or replace function public.automation_preflight()
returns table(check_id text, label text, passed boolean, detail text)
language sql security definer set search_path = public, cron, vault, pg_catalog as $$
  with required_jobs(job_name, job_label, expected_schedule, expected_marker, helper_name) as (
    values
      ('lock-official-lines-every-minute', 'Official line lock: gated every minute', '* * * * *', 'dispatch_line_lock_if_due', 'dispatch_line_lock_if_due'),
      ('refresh-nfl-schedule-and-spreads-prelock-early', 'Pre-lock spread refresh (daylight-safe)', '0 11 * 1,2,8,9,10,11,12 *', '/api/admin/import-games', null::text),
      ('refresh-nfl-schedule-and-spreads-prelock-standard', 'Pre-lock spread refresh (standard-safe)', '0 12 * 1,2,8,9,10,11,12 *', '/api/admin/import-games', null::text),
      ('refresh-final-nfl-scores-every-ten-minutes', 'Final score worker every ten minutes', '*/10 * * * *', '/api/cron/sync-scores', null::text),
      ('refresh-bowl-pool-every-fifteen-minutes', 'Bowl Pool adaptive dispatch gate (15-minute ceiling)', '*/15 * * * *', 'dispatch_bowl_sync_if_due', 'dispatch_bowl_sync_if_due'),
      ('send-pickem-browser-reminders-every-five-minutes', 'Reminder delivery every five minutes', '*/5 * * * *', '/api/cron/send-reminders', null::text),
      ('reconcile-pickem-email-schedule-every-fifteen-minutes', 'Email schedule reconciliation every fifteen minutes', '*/15 * * * *', '/api/cron/maintain-reminders', null::text),
      ('bootstrap-full-nfl-season-daily', 'Automatic preseason schedule bootstrap', '15 12 * 8,9 *', '/api/cron/bootstrap-season', null::text),
      ('pickem-operations-watchdog-every-five-minutes', 'Operations watchdog every five minutes', '*/5 * * * *', '/api/cron/watchdog', null::text)
  ), inspected as (
    select required_jobs.*,
      exists (
        select 1 from cron.job
        where jobname = required_jobs.job_name and active
          and schedule = required_jobs.expected_schedule
          and command like '%' || required_jobs.expected_marker || '%'
          and (
            (required_jobs.helper_name is null and command like '%Authorization%' and command like '%cron_secret%')
            or exists (
              select 1 from pg_catalog.pg_proc helper
              where helper.pronamespace = 'public'::regnamespace
                and helper.proname = required_jobs.helper_name
                and pg_catalog.pg_get_functiondef(helper.oid) like '%net.http_post%'
                and pg_catalog.pg_get_functiondef(helper.oid) like '%decrypted_secrets%'
            )
          )
      ) as is_correct
    from required_jobs
  )
  select 'cron-' || job_name, job_label, is_correct,
    case when is_correct then 'Active with the expected cadence, gate, endpoint, and Vault authorization.'
      else 'Missing, inactive, or different from the required cadence, gate, endpoint, or authorization.' end
  from inspected
  union all
  select 'cron-secret', 'Supabase Vault automation secret',
    exists(select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret <> ''),
    case when exists(select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret <> '')
      then 'Supabase has a non-empty cron_secret for scheduled requests.'
      else 'The vault secret cron_secret is missing or empty.' end;
$$;

revoke all on function public.automation_preflight() from public, anon, authenticated;
grant execute on function public.automation_preflight() to service_role;
