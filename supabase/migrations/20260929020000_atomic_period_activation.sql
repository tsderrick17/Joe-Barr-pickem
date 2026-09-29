-- Activating a scoring period when none is active (season opening, or recovery
-- after an interrupted handoff) previously ran as a plain application update.
-- It now uses the same protections as the weekly handoff: one lock per season,
-- exactly one active period, no skipping an unfinished earlier period, and an
-- imported schedule. Expected "not yet" conditions are reported as a reason so
-- the score worker keeps running; only an invalid request raises.

create or replace function public.activate_scoring_period_atomically(
  target_scoring_period_id uuid,
  activated_at timestamptz default clock_timestamp()
)
returns table(activated boolean, blocked_reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period public.scoring_periods%rowtype;
begin
  if activated_at is null or activated_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The scoring period activation time is invalid.';
  end if;

  select * into target_period
  from public.scoring_periods
  where id = target_scoring_period_id
  for update;

  if not found then
    raise exception 'The scoring period to activate does not exist.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_period.season_id::text || ':weekly-handoff', 0));

  -- Re-read under the lock so a concurrent handoff is seen.
  select * into target_period
  from public.scoring_periods
  where id = target_scoring_period_id;

  if target_period.status = 'active' then
    return query select false, 'This scoring period is already active.'::text;
    return;
  end if;
  if target_period.status <> 'upcoming' then
    return query select false, 'Only an upcoming scoring period can be activated.'::text;
    return;
  end if;
  if target_period.starts_at is null or target_period.starts_at > activated_at then
    return query select false, 'The scoring period has not reached its start time.'::text;
    return;
  end if;
  if exists (
    select 1 from public.scoring_periods
    where season_id = target_period.season_id
      and status = 'active'
      and id <> target_period.id
  ) then
    return query select false, 'Another scoring period is already active.'::text;
    return;
  end if;
  if exists (
    select 1 from public.scoring_periods
    where season_id = target_period.season_id
      and display_order < target_period.display_order
      and status <> 'complete'
  ) then
    return query select false, 'An earlier scoring period has not been completed.'::text;
    return;
  end if;
  if not exists (select 1 from public.games where scoring_period_id = target_period.id) then
    return query select false, 'The scoring period cannot activate without an imported schedule.'::text;
    return;
  end if;

  update public.scoring_periods
  set status = 'active'
  where id = target_period.id;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (
    null, 'scoring_period_activated', 'scoring_period', target_period.id,
    jsonb_build_object('activated_at', activated_at, 'display_order', target_period.display_order)
  );

  return query select true, null::text;
end;
$$;

revoke all on function public.activate_scoring_period_atomically(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.activate_scoring_period_atomically(uuid, timestamptz) to service_role;
