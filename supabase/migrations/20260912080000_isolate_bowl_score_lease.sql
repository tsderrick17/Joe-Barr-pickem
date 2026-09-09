-- Keep Bowl score polling independently observable and lease-protected.
alter table public.automation_execution_leases
  drop constraint if exists automation_execution_leases_job_name_check;
alter table public.automation_execution_leases
  add constraint automation_execution_leases_job_name_check
  check (job_name in ('line_locks', 'scores', 'bowl_scores', 'reminders', 'season_bootstrap', 'watchdog', 'schedule_refresh'));

create or replace function public.claim_automation_execution_lease(
  target_job_name text,
  lease_seconds integer default 120
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token uuid := gen_random_uuid();
  acquired_token uuid;
begin
  if target_job_name not in ('line_locks', 'scores', 'bowl_scores', 'reminders', 'season_bootstrap', 'watchdog', 'schedule_refresh') or lease_seconds not between 30 and 600 then
    raise exception 'Invalid automation lease request.';
  end if;
  insert into public.automation_execution_leases (job_name, token, acquired_at, locked_until)
  values (target_job_name, new_token, clock_timestamp(), clock_timestamp() + make_interval(secs => lease_seconds))
  on conflict (job_name) do update
    set token = excluded.token, acquired_at = excluded.acquired_at, locked_until = excluded.locked_until
  where public.automation_execution_leases.locked_until <= clock_timestamp()
  returning token into acquired_token;
  return acquired_token;
end;
$$;

alter table public.automation_worker_heartbeats
  drop constraint if exists automation_worker_heartbeats_job_name_check;
alter table public.automation_worker_heartbeats
  add constraint automation_worker_heartbeats_job_name_check
  check (job_name in ('line_locks', 'scores', 'bowl_scores', 'reminders', 'season_bootstrap', 'watchdog', 'schedule_refresh'));

create or replace function public.record_automation_worker_heartbeat(target_job_name text, target_status text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare recorded_at timestamptz := clock_timestamp();
begin
  if target_job_name not in ('line_locks', 'scores', 'bowl_scores', 'reminders', 'season_bootstrap', 'watchdog', 'schedule_refresh') or target_status not in ('started', 'success', 'failed', 'skipped') then
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
end; $$;
