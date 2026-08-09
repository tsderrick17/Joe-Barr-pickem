-- Finish the no-touch preseason path and add a deliberately quiet operations
-- watchdog. Alerts are incident based: one open row per signal, automatically
-- resolved when healthy, and eligible to notify again only after a recurrence.

alter table public.sync_runs drop constraint if exists sync_runs_job_type_check;
alter table public.sync_runs add constraint sync_runs_job_type_check
  check (job_type in ('schedule', 'odds', 'scores', 'line_locks', 'season_bootstrap', 'watchdog'));

create table public.automation_alerts (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null,
  severity text not null check (severity in ('critical', 'warning')),
  title text not null,
  detail text not null,
  detected_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  notified_at timestamptz,
  notification_attempted_at timestamptz,
  resolved_at timestamptz,
  notification_recipients integer not null default 0,
  notification_error text,
  details jsonb not null default '{}'::jsonb
);

create unique index automation_alerts_one_open_signal_idx
  on public.automation_alerts(signal_key) where resolved_at is null;
create index automation_alerts_recent_idx
  on public.automation_alerts(detected_at desc);
alter table public.automation_alerts enable row level security;
revoke all on table public.automation_alerts from public, anon, authenticated;

alter table public.automation_execution_leases
  drop constraint if exists automation_execution_leases_job_name_check;
alter table public.automation_execution_leases
  add constraint automation_execution_leases_job_name_check
  check (job_name in ('line_locks', 'scores', 'reminders', 'season_bootstrap', 'watchdog'));

create or replace function public.claim_automation_execution_lease(
  target_job_name text,
  lease_seconds integer default 120
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_token uuid := gen_random_uuid();
  acquired_token uuid;
begin
  if target_job_name not in ('line_locks', 'scores', 'reminders', 'season_bootstrap', 'watchdog')
    or lease_seconds not between 30 and 600 then
    raise exception 'Invalid automation lease request.';
  end if;
  insert into public.automation_execution_leases(job_name, token, acquired_at, locked_until)
  values (target_job_name, new_token, clock_timestamp(), clock_timestamp() + make_interval(secs => lease_seconds))
  on conflict (job_name) do update set token = excluded.token,
    acquired_at = excluded.acquired_at, locked_until = excluded.locked_until
  where public.automation_execution_leases.locked_until <= clock_timestamp()
  returning token into acquired_token;
  return acquired_token;
end;
$$;

-- The NFL schedule is normally complete well before August. Starting on the
-- pool's August 1 season boundary gives the provider a daily retry path while
-- retaining several weeks of safety margin before Week 1.
select cron.unschedule(jobid::integer)
from cron.job
where jobname = 'bootstrap-full-nfl-season-daily';
select cron.schedule(
  'bootstrap-full-nfl-season-daily',
  '15 12 * 8,9 *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/bootstrap-season',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

select cron.unschedule(jobid::integer)
from cron.job
where jobname = 'pickem-operations-watchdog-every-five-minutes';
select cron.schedule(
  'pickem-operations-watchdog-every-five-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

create or replace function public.automation_preflight()
returns table(check_id text, label text, passed boolean, detail text)
language sql security definer set search_path = public, cron, vault as $$
  with required_jobs(job_name, job_label) as (
    values
      ('lock-official-lines-every-minute', 'Official line lock every minute'),
      ('refresh-nfl-schedule-and-spreads-prelock-early', 'Pre-lock schedule refresh (early)'),
      ('refresh-nfl-schedule-and-spreads-prelock-standard', 'Pre-lock schedule refresh (standard)'),
      ('refresh-final-nfl-scores-every-15-minutes', 'Final score refresh every 15 minutes'),
      ('send-pickem-browser-reminders-every-five-minutes', 'Reminder delivery every five minutes'),
      ('bootstrap-full-nfl-season-daily', 'Automatic preseason schedule bootstrap'),
      ('pickem-operations-watchdog-every-five-minutes', 'Operations watchdog every five minutes')
  )
  select 'cron-' || required_jobs.job_name, required_jobs.job_label,
    exists(select 1 from cron.job where jobname = required_jobs.job_name and active),
    case when exists(select 1 from cron.job where jobname = required_jobs.job_name and active)
      then 'Scheduled and active.' else 'Missing or inactive.' end
  from required_jobs
  union all
  select 'cron-secret', 'Shared automation secret',
    exists(select 1 from vault.decrypted_secrets where name = 'cron_secret'),
    case when exists(select 1 from vault.decrypted_secrets where name = 'cron_secret')
      then 'Supabase can authenticate scheduled requests.' else 'The vault secret cron_secret is missing.' end;
$$;

revoke all on function public.automation_preflight() from public, anon, authenticated;
grant execute on function public.automation_preflight() to service_role;
