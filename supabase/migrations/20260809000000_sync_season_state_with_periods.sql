-- Keep the season-level state aligned with the authoritative scoring-period
-- lifecycle. Weekly score automation already activates and completes periods;
-- this trigger makes the regular-season, playoff, and final-season transitions
-- happen in the same transaction without a commissioner edit.

create or replace function public.refresh_season_state_from_periods(
  target_season_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_state text;
  desired_state text;
  active_period_type text;
begin
  select state into prior_state
  from public.seasons
  where id = target_season_id
  for update;

  if prior_state is null then
    return null;
  end if;

  select period_type into active_period_type
  from public.scoring_periods
  where season_id = target_season_id
    and status = 'active'
  limit 1;

  if active_period_type = 'playoff' then
    desired_state := 'playoffs';
  elsif active_period_type = 'regular' then
    desired_state := 'regular_season';
  elsif exists (
    select 1 from public.scoring_periods
    where season_id = target_season_id
  ) and not exists (
    select 1 from public.scoring_periods
    where season_id = target_season_id
      and status <> 'complete'
  ) then
    desired_state := 'complete';
  else
    return prior_state;
  end if;

  if desired_state is distinct from prior_state then
    update public.seasons
    set state = desired_state
    where id = target_season_id;

    insert into public.audit_logs (action, entity_type, entity_id, details)
    values (
      'season_state_changed',
      'season',
      target_season_id,
      jsonb_build_object('from', prior_state, 'to', desired_state, 'automatic', true)
    );
  end if;

  return desired_state;
end;
$$;

create or replace function public.refresh_season_state_after_period_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_season_state_from_periods(new.season_id);
  return new;
end;
$$;

drop trigger if exists refresh_season_state_after_period_change
  on public.scoring_periods;
create trigger refresh_season_state_after_period_change
after insert or update of status on public.scoring_periods
for each row
execute function public.refresh_season_state_after_period_change();

-- Align any already-running season once when this migration is deployed.
select public.refresh_season_state_from_periods(id)
from public.seasons;

revoke all on function public.refresh_season_state_from_periods(uuid)
  from public, anon, authenticated;
revoke all on function public.refresh_season_state_after_period_change()
  from public, anon, authenticated;
grant execute on function public.refresh_season_state_from_periods(uuid)
  to service_role;
