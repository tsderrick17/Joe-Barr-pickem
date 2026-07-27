-- A short, token-owned lease prevents cron and a manual Commissioner run from
-- executing the same automation at the same time. Expiry makes recovery safe
-- if a server invocation stops unexpectedly.

create table if not exists public.automation_execution_leases (
  job_name text primary key check (job_name in ('line_locks', 'scores')),
  token uuid not null,
  acquired_at timestamptz not null default clock_timestamp(),
  locked_until timestamptz not null
);

alter table public.automation_execution_leases enable row level security;

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
  if target_job_name not in ('line_locks', 'scores') or lease_seconds not between 30 and 600 then
    raise exception 'Invalid automation lease request.';
  end if;

  insert into public.automation_execution_leases (
    job_name, token, acquired_at, locked_until
  ) values (
    target_job_name,
    new_token,
    clock_timestamp(),
    clock_timestamp() + make_interval(secs => lease_seconds)
  )
  on conflict (job_name) do update
    set token = excluded.token,
        acquired_at = excluded.acquired_at,
        locked_until = excluded.locked_until
  where public.automation_execution_leases.locked_until <= clock_timestamp()
  returning token into acquired_token;

  return acquired_token;
end;
$$;

create or replace function public.release_automation_execution_lease(
  target_job_name text,
  lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.automation_execution_leases
  set locked_until = clock_timestamp()
  where job_name = target_job_name and token = lease_token;

  return found;
end;
$$;
