-- Failed PINs and network addresses stay out of this audit trail. The app
-- stores keyed fingerprints only, so database records cannot be reversed into
-- a PIN list or an address book.
create table public.pin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  pin_fingerprint text not null check (pin_fingerprint ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default clock_timestamp()
);

create index pin_login_attempts_source_time_idx
  on public.pin_login_attempts(source_fingerprint, attempted_at desc);

create table public.pin_login_incidents (
  id uuid primary key default gen_random_uuid(),
  source_fingerprint text not null unique check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  detected_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  alert_until timestamptz not null,
  attempted_pins integer not null check (attempted_pins >= 10)
);

create index pin_login_incidents_alert_idx on public.pin_login_incidents(alert_until);

alter table public.pin_login_attempts enable row level security;
alter table public.pin_login_incidents enable row level security;
revoke all on table public.pin_login_attempts, public.pin_login_incidents from public, anon, authenticated;

-- Record one failed attempt and open an alert after ten different invalid PINs
-- from the same source within fifteen minutes. The incident remains visible to
-- the five-minute watchdog for one day, but it does not lock out sign-in.
create or replace function public.record_failed_pin_login(
  attempt_source_fingerprint text,
  attempt_pin_fingerprint text,
  threshold integer default 10,
  window_seconds integer default 900
)
returns table(incident_id uuid, opened boolean)
language plpgsql security definer set search_path = public as $$
declare
  attempted_pin_count integer;
  existing_incident_id uuid;
begin
  if attempt_source_fingerprint !~ '^[0-9a-f]{64}$'
    or attempt_pin_fingerprint !~ '^[0-9a-f]{64}$'
    or threshold <> 10
    or window_seconds <> 900 then
    raise exception 'Invalid PIN-login security event.';
  end if;

  delete from public.pin_login_attempts
  where attempted_at < clock_timestamp() - interval '24 hours';

  insert into public.pin_login_attempts(source_fingerprint, pin_fingerprint)
  values (attempt_source_fingerprint, attempt_pin_fingerprint);

  select count(distinct pin_fingerprint)::integer into attempted_pin_count
  from public.pin_login_attempts
  where source_fingerprint = attempt_source_fingerprint
    and attempted_at >= clock_timestamp() - make_interval(secs => window_seconds);

  if attempted_pin_count < threshold then
    return query select null::uuid, false;
    return;
  end if;

  select id into existing_incident_id
  from public.pin_login_incidents
  where source_fingerprint = attempt_source_fingerprint
    and alert_until > clock_timestamp();

  if existing_incident_id is not null then
    update public.pin_login_incidents
    set attempted_pins = greatest(attempted_pins, attempted_pin_count),
        last_seen_at = clock_timestamp()
    where id = existing_incident_id;
    return query select existing_incident_id, false;
    return;
  end if;

  insert into public.pin_login_incidents(
    source_fingerprint, detected_at, last_seen_at, alert_until, attempted_pins
  ) values (
    attempt_source_fingerprint, clock_timestamp(), clock_timestamp(),
    clock_timestamp() + interval '24 hours', attempted_pin_count
  )
  on conflict (source_fingerprint) do update
    set detected_at = excluded.detected_at,
        last_seen_at = excluded.last_seen_at,
        alert_until = excluded.alert_until,
        attempted_pins = excluded.attempted_pins
  returning id into existing_incident_id;

  return query select existing_incident_id, true;
end;
$$;

revoke all on function public.record_failed_pin_login(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_failed_pin_login(text, text, integer, integer) to service_role;

create or replace function public.clear_failed_pin_logins(attempt_source_fingerprint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if attempt_source_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid PIN-login security source.';
  end if;
  delete from public.pin_login_attempts where source_fingerprint = attempt_source_fingerprint;
end;
$$;

revoke all on function public.clear_failed_pin_logins(text) from public, anon, authenticated;
grant execute on function public.clear_failed_pin_logins(text) to service_role;
