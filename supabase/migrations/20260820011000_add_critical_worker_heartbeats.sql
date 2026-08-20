-- Constant-size execution receipts prove that each critical worker is actually
-- being invoked. One row per job is updated in place, so monitoring cannot
-- create unbounded database growth.

create table if not exists public.automation_worker_heartbeats (
  job_name text primary key check (job_name in (
    'line_locks', 'scores', 'reminders', 'season_bootstrap', 'watchdog', 'schedule_refresh'
  )),
  last_status text not null check (last_status in ('started', 'success', 'failed', 'skipped')),
  last_started_at timestamptz not null,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.automation_worker_heartbeats enable row level security;
revoke all on table public.automation_worker_heartbeats from public, anon, authenticated;

create or replace function public.record_automation_worker_heartbeat(
  target_job_name text,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  recorded_at timestamptz := clock_timestamp();
begin
  if target_job_name not in (
    'line_locks', 'scores', 'reminders', 'season_bootstrap', 'watchdog', 'schedule_refresh'
  ) or target_status not in ('started', 'success', 'failed', 'skipped') then
    raise exception 'Invalid automation heartbeat.';
  end if;

  insert into public.automation_worker_heartbeats (
    job_name, last_status, last_started_at, last_succeeded_at, last_failed_at, updated_at
  ) values (
    target_job_name,
    target_status,
    recorded_at,
    case when target_status = 'success' then recorded_at end,
    case when target_status = 'failed' then recorded_at end,
    recorded_at
  )
  on conflict (job_name) do update set
    last_status = excluded.last_status,
    last_started_at = case
      when target_status = 'started' then recorded_at
      else public.automation_worker_heartbeats.last_started_at
    end,
    last_succeeded_at = case
      when target_status = 'success' then recorded_at
      else public.automation_worker_heartbeats.last_succeeded_at
    end,
    last_failed_at = case
      when target_status = 'failed' then recorded_at
      else public.automation_worker_heartbeats.last_failed_at
    end,
    updated_at = recorded_at;
end;
$$;

revoke all on function public.record_automation_worker_heartbeat(text, text)
  from public, anon, authenticated;
grant execute on function public.record_automation_worker_heartbeat(text, text)
  to service_role;
