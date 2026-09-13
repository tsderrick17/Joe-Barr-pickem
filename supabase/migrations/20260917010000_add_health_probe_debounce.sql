-- Keep one transient public health failure from opening an incident. The
-- durable timestamp is shared by all serverless instances and resets on the
-- first healthy probe, so recovery remains immediate.
create table if not exists public.health_probe_states (
  probe_name text primary key check (probe_name in ('critical_workers')),
  unhealthy_since timestamptz,
  last_checked_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.health_probe_states enable row level security;
revoke all on table public.health_probe_states from public, anon, authenticated;
grant select, insert, update on table public.health_probe_states to service_role;
