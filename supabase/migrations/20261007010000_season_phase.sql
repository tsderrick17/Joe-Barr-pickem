-- Off-season mode: one definition of "the season is over", used by every dispatcher.
--
-- The pool's season runs from August 1 (Eastern) until the Super Bowl is final and
-- graded. refresh_season_state_from_periods() already marks a season 'complete' when
-- every scoring period, including the Super Bowl, is complete, so the off-season is
-- exactly "the current season-year row is complete and its Super Bowl is complete".
-- At 12:00 AM Eastern on August 1 the season year turns over, the new year has no
-- completed Super Bowl, and the phase flips back to in_season without anyone
-- pressing a button.

create or replace function public.season_phase(evaluated_at timestamptz default clock_timestamp())
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case when exists (
    select 1
    from public.seasons season
    where season.year = extract(year from (evaluated_at at time zone 'America/New_York'))::integer
        - case when extract(month from (evaluated_at at time zone 'America/New_York')) < 8 then 1 else 0 end
      and season.state = 'complete'
      and exists (
        select 1 from public.scoring_periods period
        where period.season_id = season.id
          and period.display_name = 'Super Bowl'
          and period.status = 'complete'
      )
  ) then 'off_season' else 'in_season' end;
$$;

-- The Bowl Pool has its own, shorter window: it opens December 1 (Eastern; players
-- first see it on Selection Sunday, December 7 or later) and closes when the Bowl
-- Pool champion is crowned. It is never open in the NFL off-season.
create or replace function public.bowl_window_open(evaluated_at timestamptz default clock_timestamp())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    public.season_phase(evaluated_at) = 'in_season'
    and (extract(month from (evaluated_at at time zone 'America/New_York')) >= 12
      or extract(month from (evaluated_at at time zone 'America/New_York')) < 8)
    and not exists (
      select 1 from public.bowl_pool_seasons bowl
      where bowl.status = 'complete'
        and bowl.season_year = extract(year from (evaluated_at at time zone 'America/New_York'))::integer
          - case when extract(month from (evaluated_at at time zone 'America/New_York')) < 8 then 1 else 0 end
    );
$$;

revoke all on function public.season_phase(timestamptz) from public, anon, authenticated;
revoke all on function public.bowl_window_open(timestamptz) from public, anon, authenticated;
grant execute on function public.season_phase(timestamptz) to service_role;
grant execute on function public.bowl_window_open(timestamptz) to service_role;

-- Database-side gates: an idle off-season tick stays inside Supabase and never
-- calls Vercel.
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
  if public.season_phase() = 'off_season' then return false; end if;
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

create or replace function public.dispatch_reminders_if_due()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, net, vault
as $$
declare
  shared_secret text;
  request_id bigint;
begin
  if public.season_phase() = 'off_season' then return false; end if;
  if not public.reminder_delivery_is_due() then return false; end if;
  select decrypted_secret into shared_secret
  from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if coalesce(shared_secret, '') = '' then raise exception 'The automation secret is missing.'; end if;
  request_id := net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || shared_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  return request_id is not null;
end;
$$;

-- The Bowl dispatcher keeps creating the season row (it is cheap and other pages
-- expect it) but only calls Vercel inside the Bowl window.
create or replace function public.dispatch_bowl_sync_if_due()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, net, vault
as $$
declare
  season_year_value integer := extract(year from (clock_timestamp() at time zone 'America/New_York'))::integer;
  season_month integer := extract(month from (clock_timestamp() at time zone 'America/New_York'))::integer;
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

  if not public.bowl_window_open(evaluated_at) then return false; end if;

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

revoke all on function public.dispatch_line_lock_if_due() from public, anon, authenticated;
revoke all on function public.dispatch_reminders_if_due() from public, anon, authenticated;
revoke all on function public.dispatch_bowl_sync_if_due() from public, anon, authenticated;
grant execute on function public.dispatch_line_lock_if_due() to service_role;
grant execute on function public.dispatch_reminders_if_due() to service_role;
grant execute on function public.dispatch_bowl_sync_if_due() to service_role;

-- The score worker, the pre-lock spread refresh and the email-schedule
-- reconciliation call Vercel directly from pg_cron. Keep their schedules, job
-- names and URLs (the launch preflight inspects them) and add the same gate to
-- each command, so the off-season never wakes a function. The preseason bootstrap
-- and the watchdog stay ungated: bootstrap performs the August 1 rollover.
-- Production exposes pg_cron helper functions; isolated rehearsal databases do not.
do $migration$
declare
  gate text := ' where public.season_phase() = ''in_season'';';
  jobs jsonb := jsonb_build_array(
    jsonb_build_object('name', 'refresh-final-nfl-scores-every-ten-minutes', 'schedule', '*/10 * * * *', 'path', 'api/cron/sync-scores'),
    jsonb_build_object('name', 'refresh-nfl-schedule-and-spreads-prelock-early', 'schedule', '0 11 * 1,2,8,9,10,11,12 *', 'path', 'api/admin/import-games'),
    jsonb_build_object('name', 'refresh-nfl-schedule-and-spreads-prelock-standard', 'schedule', '0 12 * 1,2,8,9,10,11,12 *', 'path', 'api/admin/import-games'),
    jsonb_build_object('name', 'reconcile-pickem-email-schedule-every-fifteen-minutes', 'schedule', '*/15 * * * *', 'path', 'api/cron/maintain-reminders')
  );
  job jsonb;
  command_text text;
begin
  for job in select * from jsonb_array_elements(jobs) loop
    command_text := format($command$
    select net.http_post(
      url := 'https://pickemjb.vercel.app/%s',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )%s
  $command$, job ->> 'path', gate);

    if to_regprocedure('cron.unschedule(integer)') is not null then
      execute format('select cron.unschedule(jobid::integer) from cron.job where jobname = %L', job ->> 'name');
    elsif to_regprocedure('cron.unschedule(bigint)') is not null then
      execute format('select cron.unschedule(jobid) from cron.job where jobname = %L', job ->> 'name');
    end if;

    if to_regprocedure('cron.schedule(text,text,text)') is not null then
      execute format('select cron.schedule(%L, %L, %L)', job ->> 'name', job ->> 'schedule', command_text);
    elsif to_regprocedure('cron.schedule(text,text)') is not null then
      execute format('select cron.schedule(%L, %L)', job ->> 'schedule', command_text);
    end if;
  end loop;
end
$migration$;
