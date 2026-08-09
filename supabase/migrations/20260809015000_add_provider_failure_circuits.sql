-- Keep automatic provider outages from consuming credits and server time on
-- every scheduled invocation. This table contains operational state only.
create table public.provider_failure_circuits (
  provider_job text primary key check (provider_job in ('schedule_refresh')),
  consecutive_failures integer not null check (consecutive_failures > 0),
  last_failed_at timestamptz not null,
  next_retry_at timestamptz not null,
  last_error text not null,
  updated_at timestamptz not null default clock_timestamp()
);

create index provider_failure_circuits_retry_idx
  on public.provider_failure_circuits(next_retry_at);

alter table public.provider_failure_circuits enable row level security;
revoke all on table public.provider_failure_circuits from public, anon, authenticated;

-- Schedule refreshes can be started by cron or by the Commissioner. They use
-- one shared token-owned lease, just like scoring and official line locking.
alter table public.automation_execution_leases
  drop constraint if exists automation_execution_leases_job_name_check;
alter table public.automation_execution_leases
  add constraint automation_execution_leases_job_name_check
  check (job_name in ('line_locks', 'scores', 'reminders', 'season_bootstrap', 'watchdog', 'schedule_refresh'));

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
  if target_job_name not in ('line_locks', 'scores', 'reminders', 'season_bootstrap', 'watchdog', 'schedule_refresh')
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

revoke all on function public.claim_automation_execution_lease(text, integer) from public, anon, authenticated;
grant execute on function public.claim_automation_execution_lease(text, integer) to service_role;
