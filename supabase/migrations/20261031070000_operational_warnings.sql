-- Warnings the background workers used to leave only in the Vercel log, which Hobby keeps for a short time.
--
-- One row per distinct warning (job + wording), so a problem that repeats every few minutes is one line that counts its occurrences, not a flood.
-- The wording is fixed text; what changes between sightings (which game, which error code) lives in details and is overwritten with the latest.
-- record_operational_warning answers true when the warning is new or has been quiet for 12 hours, which is when the app also reports it to Sentry.
create table if not exists public.operational_warnings (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint operational_warnings_job_message_key unique (job, message)
);

create index if not exists operational_warnings_last_seen_idx on public.operational_warnings (last_seen_at desc);

alter table public.operational_warnings enable row level security;

revoke all on table public.operational_warnings from anon, authenticated;

grant all privileges on public.operational_warnings to service_role;

create or replace function public.record_operational_warning(target_job text, target_message text, target_details jsonb default '{}'::jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  previous_seen timestamptz;
begin
  -- Warnings that have not come back in 30 days are dropped here, so the table stays small without a separate job.
  delete from public.operational_warnings where last_seen_at < now() - interval '30 days';

  select last_seen_at into previous_seen from public.operational_warnings where job = target_job and message = target_message for update;
  if not found then
    insert into public.operational_warnings (job, message, details) values (target_job, target_message, coalesce(target_details, '{}'::jsonb))
    on conflict (job, message) do update set occurrences = operational_warnings.occurrences + 1, last_seen_at = now(), details = excluded.details;
    return true;
  end if;
  update public.operational_warnings
  set occurrences = occurrences + 1, last_seen_at = now(), details = coalesce(target_details, '{}'::jsonb)
  where job = target_job and message = target_message;
  return previous_seen < now() - interval '12 hours';
end;
$$;

revoke all on function public.record_operational_warning(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_operational_warning(text, text, jsonb) to service_role;
