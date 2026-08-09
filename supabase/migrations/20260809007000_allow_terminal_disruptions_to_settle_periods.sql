-- A commissioner-declared cancellation or no-contest is a terminal outcome:
-- there will never be a final score to import. Permit those audited outcomes
-- to complete a period after all affected ATS and Survivor picks have left the
-- pending state. Postponed and otherwise unfinished games continue to block.

create or replace function public.complete_scoring_period_atomically(
  target_scoring_period_id uuid,
  next_scoring_period_id uuid,
  rollover_at timestamptz
)
returns table(completed_period_id uuid, activated_period_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period public.scoring_periods%rowtype;
  next_period public.scoring_periods%rowtype;
  terminal_disruption_count integer;
begin
  if rollover_at is null or rollover_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The weekly handoff time is invalid.';
  end if;

  select * into target_period
  from public.scoring_periods
  where id = target_scoring_period_id
  for update;

  if not found or target_period.status <> 'active' then
    raise exception 'Only the active scoring period can be completed.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_period.season_id::text || ':weekly-handoff', 0));

  if exists (
    select 1 from public.games
    where scoring_period_id = target_period.id
      and status not in ('final', 'cancelled', 'no_contest')
  ) then
    raise exception 'Every game must be settled before the weekly handoff.';
  end if;

  if not exists (select 1 from public.games where scoring_period_id = target_period.id) then
    raise exception 'A scoring period without games cannot be completed automatically.';
  end if;

  if exists (
    select 1 from public.games
    where scoring_period_id = target_period.id
      and status = 'final'
      and finalized_at is null
  ) then
    raise exception 'Every final game requires an accepted final-score timestamp.';
  end if;

  if exists (
    select 1 from public.picks
    where scoring_period_id = target_period.id
      and result = 'pending'
  ) then
    raise exception 'Final ATS picks still need an official line or grade.';
  end if;

  if exists (
    select 1 from public.survivor_picks
    where scoring_period_id = target_period.id
      and result = 'pending'
  ) then
    raise exception 'Survivor picks still need a final grade or audited void.';
  end if;

  if next_scoring_period_id is not null then
    select * into next_period
    from public.scoring_periods
    where id = next_scoring_period_id
    for update;

    if not found
      or next_period.season_id <> target_period.season_id
      or next_period.display_order <> target_period.display_order + 1
      or next_period.status <> 'upcoming' then
      raise exception 'The next scoring period is not eligible for activation.';
    end if;

    if not exists (select 1 from public.games where scoring_period_id = next_period.id) then
      raise exception 'The next scoring period cannot activate without an imported schedule.';
    end if;
  end if;

  select count(*)::integer into terminal_disruption_count
  from public.games
  where scoring_period_id = target_period.id
    and status in ('cancelled', 'no_contest');

  update public.scoring_periods
  set status = 'complete'
  where id = target_period.id;

  if next_scoring_period_id is not null then
    update public.scoring_periods
    set status = 'active'
    where id = next_scoring_period_id;
  end if;

  insert into public.audit_logs (
    actor_player_id, action, entity_type, entity_id, details
  ) values (
    null, 'scoring_period_completed', 'scoring_period', target_period.id,
    jsonb_build_object(
      'rollover_at', rollover_at,
      'next_scoring_period_id', next_scoring_period_id,
      'terminal_disruptions', terminal_disruption_count
    )
  );

  return query select target_period.id, next_scoring_period_id;
end;
$$;

revoke all on function public.complete_scoring_period_atomically(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_scoring_period_atomically(uuid, uuid, timestamptz)
  to service_role;
