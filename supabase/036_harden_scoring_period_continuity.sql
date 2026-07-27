-- A period's identity and pick limit become part of the permanent scoreboard
-- contract as soon as a schedule is attached. This covers both regular weeks
-- and the four playoff rounds.

create unique index if not exists scoring_periods_one_active_per_season_idx
  on public.scoring_periods (season_id)
  where status = 'active';

create or replace function public.prevent_scoring_period_config_changes()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.games where scoring_period_id = old.id
  ) and (
    new.display_name is distinct from old.display_name
    or new.display_order is distinct from old.display_order
    or new.period_type is distinct from old.period_type
    or new.max_picks is distinct from old.max_picks
  ) then
    raise exception 'A scoring period configuration cannot change after games are assigned.';
  end if;

  if new.period_type = 'playoff' then
    if (new.display_name = 'Wild Card' and new.max_picks <> 6)
      or (new.display_name = 'Divisional Round' and new.max_picks <> 4)
      or (new.display_name = 'Conference Championships' and new.max_picks <> 2)
      or (new.display_name = 'Super Bowl' and new.max_picks <> 1)
      or new.display_name not in ('Wild Card', 'Divisional Round', 'Conference Championships', 'Super Bowl') then
      raise exception 'Playoff scoring periods must use the configured round name and pick limit.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_scoring_period_config_changes on public.scoring_periods;
create trigger prevent_scoring_period_config_changes
before update of display_name, display_order, period_type, max_picks
on public.scoring_periods
for each row execute function public.prevent_scoring_period_config_changes();
