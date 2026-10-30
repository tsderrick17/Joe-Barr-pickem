-- Call Vercel only when there is background work.
--
-- Vercel measured (2026-10-30) that most of the pool's Fluid CPU is idle
-- background ticks: the score worker woke every ten minutes around the clock
-- (180 ms of CPU each, almost always with nothing to do), the email-schedule
-- reconciliation every fifteen minutes and the watchdog every ten. A wake-up
-- costs about 200 ms of CPU whatever the work, so the number of calls is what
-- counts.
--
-- 1. The score worker gets a database-side gate like the line-lock, reminder
--    and Bowl dispatchers. It is called when a final is due, when a time the
--    worker asked for has come (week handoff, Survivor deadline, playoff day
--    start), when a week is waiting to open, when picks can be settled now, and
--    at least once an hour as a safety run.
-- 2. The email-schedule reconciliation runs every thirty minutes (at :05 and
--    :35), which still follows the 7 AM Eastern spread refresh by five minutes
--    and the Tuesday 6:30 AM recap eligibility by five.
-- 3. The watchdog runs every fifteen minutes; its 35-minute heartbeat window
--    still absorbs one missed run.

create table if not exists public.automation_dispatch_state (
  job_name text primary key check (job_name in ('scores')),
  last_dispatched_at timestamptz,
  next_due_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.automation_dispatch_state enable row level security;
revoke all on public.automation_dispatch_state from public, anon, authenticated;
grant all privileges on public.automation_dispatch_state to service_role;

create or replace function public.score_work_is_due(evaluated_at timestamptz default clock_timestamp())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    -- A final is due: kicked off at least 170 minutes ago (FIRST_SCORE_CHECK_DELAY_MINUTES),
    -- not final yet, and past any provider retry timer.
    exists (
      select 1
      from public.games game
      where game.status in ('scheduled', 'live')
        and game.kickoff_at <= evaluated_at - interval '170 minutes'
        and not exists (
          select 1 from public.score_check_backoff backoff
          where backoff.game_id = game.id and backoff.next_check_at > evaluated_at
        )
    )
    -- A time the worker asked to be woken at.
    or exists (
      select 1 from public.automation_dispatch_state state
      where state.job_name = 'scores' and state.next_due_at <= evaluated_at
    )
    -- A week is waiting to open.
    or (
      not exists (select 1 from public.scoring_periods period where period.status = 'active')
      and exists (
        select 1 from public.scoring_periods period
        where period.status = 'upcoming' and period.starts_at <= evaluated_at
      )
    )
    -- Picks a run can settle now: a no-contest game, or a final game that has its official line.
    or exists (
      select 1
      from public.picks pick
      join public.games game on game.id = pick.game_id
      where pick.result = 'pending'
        and (
          game.status = 'no_contest'
          or (game.status = 'final' and exists (select 1 from public.game_lines line where line.game_id = game.id))
        )
    )
    or exists (
      select 1
      from public.survivor_picks pick
      join public.games game on game.id = pick.game_id
      where pick.result = 'pending' and game.status = 'no_contest'
    )
    -- The hourly safety run.
    or not exists (
      select 1 from public.automation_dispatch_state state
      where state.job_name = 'scores' and state.last_dispatched_at > evaluated_at - interval '55 minutes'
    );
$$;

create or replace function public.dispatch_score_sync_if_due()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, net, vault
as $$
declare
  shared_secret text;
  request_id bigint;
  evaluated_at timestamptz := clock_timestamp();
begin
  if public.season_phase(evaluated_at) = 'off_season' then return false; end if;
  if not public.score_work_is_due(evaluated_at) then return false; end if;
  select decrypted_secret into shared_secret
  from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if coalesce(shared_secret, '') = '' then raise exception 'The automation secret is missing.'; end if;
  request_id := net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/sync-scores',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || shared_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  if request_id is null then return false; end if;
  insert into public.automation_dispatch_state (job_name, last_dispatched_at, updated_at)
  values ('scores', evaluated_at, evaluated_at)
  on conflict (job_name) do update
    set last_dispatched_at = excluded.last_dispatched_at, updated_at = excluded.updated_at;
  return true;
end;
$$;

revoke all on function public.score_work_is_due(timestamptz) from public, anon, authenticated;
revoke all on function public.dispatch_score_sync_if_due() from public, anon, authenticated;
grant execute on function public.score_work_is_due(timestamptz) to service_role;
grant execute on function public.dispatch_score_sync_if_due() to service_role;

-- Production exposes pg_cron helper functions; isolated rehearsal databases do not.
do $migration$
declare
  job record;
  reconcile_command text := $job$
    select net.http_post(
      url := 'https://pickemjb.vercel.app/api/cron/maintain-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) where public.season_phase() = 'in_season';
  $job$;
  watchdog_command text := $job$select net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );$job$;
begin
  for job in select jobid from cron.job where jobname in (
    'refresh-final-nfl-scores-every-ten-minutes',
    'reconcile-pickem-email-schedule-every-fifteen-minutes',
    'reconcile-pickem-email-schedule-every-thirty-minutes',
    'pickem-operations-watchdog-every-ten-minutes',
    'pickem-operations-watchdog-every-fifteen-minutes'
  ) loop
    if to_regprocedure('cron.unschedule(integer)') is not null then
      perform cron.unschedule(job.jobid::integer);
    elsif to_regprocedure('cron.unschedule(bigint)') is not null then
      perform cron.unschedule(job.jobid);
    end if;
  end loop;

  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('refresh-final-nfl-scores-every-ten-minutes', '*/10 * * * *', 'select public.dispatch_score_sync_if_due();');
    perform cron.schedule('reconcile-pickem-email-schedule-every-thirty-minutes', '5,35 * * * *', reconcile_command);
    perform cron.schedule('pickem-operations-watchdog-every-fifteen-minutes', '*/15 * * * *', watchdog_command);
  elsif to_regprocedure('cron.schedule(text,text)') is not null then
    perform cron.schedule('*/10 * * * *', 'select public.dispatch_score_sync_if_due();');
    perform cron.schedule('5,35 * * * *', reconcile_command);
    perform cron.schedule('*/15 * * * *', watchdog_command);
  end if;
end
$migration$;

-- Preflight now expects the gated score worker, the thirty-minute reconciliation
-- and the fifteen-minute watchdog.
create or replace function public.automation_preflight()
returns table(check_id text, label text, passed boolean, detail text)
language sql security definer set search_path = public, cron, vault, pg_catalog as $$
  with required_jobs(job_name, job_label, expected_schedule, expected_marker, helper_name) as (
    values
      ('lock-official-lines-every-minute', 'Official line lock: gated every minute', '* * * * *', 'dispatch_line_lock_if_due', 'dispatch_line_lock_if_due'),
      ('refresh-nfl-schedule-and-spreads-prelock-early', 'Pre-lock spread refresh (daylight-safe)', '0 11 * 1,2,8,9,10,11,12 *', '/api/admin/import-games', null::text),
      ('refresh-nfl-schedule-and-spreads-prelock-standard', 'Pre-lock spread refresh (standard-safe)', '0 12 * 1,2,8,9,10,11,12 *', '/api/admin/import-games', null::text),
      ('refresh-final-nfl-scores-every-ten-minutes', 'Final score worker: gated every ten minutes', '*/10 * * * *', 'dispatch_score_sync_if_due', 'dispatch_score_sync_if_due'),
      ('refresh-bowl-pool-every-fifteen-minutes', 'Bowl Pool adaptive dispatch gate (15-minute ceiling)', '*/15 * * * *', 'dispatch_bowl_sync_if_due', 'dispatch_bowl_sync_if_due'),
      ('send-pickem-browser-reminders-every-five-minutes', 'Reminder delivery: gated every five minutes', '*/5 * * * *', 'dispatch_reminders_if_due', 'dispatch_reminders_if_due'),
      ('reconcile-pickem-email-schedule-every-thirty-minutes', 'Email schedule reconciliation every thirty minutes', '5,35 * * * *', '/api/cron/maintain-reminders', null::text),
      ('bootstrap-full-nfl-season-daily', 'Automatic preseason schedule bootstrap', '15 12 * 8,9 *', '/api/cron/bootstrap-season', null::text),
      ('pickem-operations-watchdog-every-fifteen-minutes', 'Operations watchdog every fifteen minutes', '*/15 * * * *', '/api/cron/watchdog', null::text)
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
