-- Survivor is automatic for every active player. This function is safe to
-- call repeatedly from the app as players are added or reactivated.
create or replace function public.ensure_survivor_entries(target_season_id uuid)
returns void
language sql
as $$
  insert into public.survivor_entries (player_id, season_id)
  select id, target_season_id
  from public.players
  where active = true
  on conflict (player_id, season_id) do nothing;
$$;

create or replace function public.validate_survivor_pick()
returns trigger
language plpgsql
as $$
declare
  game_period_id uuid;
  game_away_team_id uuid;
  game_home_team_id uuid;
  game_kickoff_at timestamptz;
  entry_season_id uuid;
  entry_status text;
  period_season_id uuid;
begin
  select scoring_period_id, away_team_id, home_team_id, kickoff_at
  into game_period_id, game_away_team_id, game_home_team_id, game_kickoff_at
  from public.games
  where id = new.game_id;

  if game_period_id is null or new.scoring_period_id is distinct from game_period_id then
    raise exception 'A Survivor pick must belong to the selected game''s week.';
  end if;

  if new.selected_team_id not in (game_away_team_id, game_home_team_id) then
    raise exception 'A Survivor pick must select one of the two teams in that game.';
  end if;

  if now() >= game_kickoff_at then
    raise exception 'That Survivor game has already started.';
  end if;

  select season_id, status
  into entry_season_id, entry_status
  from public.survivor_entries
  where id = new.survivor_entry_id;

  select season_id into period_season_id
  from public.scoring_periods
  where id = new.scoring_period_id;

  if entry_season_id is null or entry_season_id is distinct from period_season_id then
    raise exception 'The Survivor entry does not belong to this season.';
  end if;

  if entry_status is distinct from 'active' then
    raise exception 'This Survivor entry is no longer active.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_survivor_pick on public.survivor_picks;

create trigger validate_survivor_pick
before insert or update of scoring_period_id, game_id, selected_team_id
on public.survivor_picks
for each row
execute function public.validate_survivor_pick();

create or replace function public.replace_unlocked_survivor_pick(
  target_survivor_entry_id uuid,
  target_scoring_period_id uuid,
  replacement_pick jsonb
)
returns void
language plpgsql
as $$
begin
  delete from public.survivor_picks
  using public.games
  where survivor_picks.survivor_entry_id = target_survivor_entry_id
    and survivor_picks.scoring_period_id = target_scoring_period_id
    and games.id = survivor_picks.game_id
    and games.kickoff_at > now();

  if replacement_pick is not null then
    insert into public.survivor_picks (
      survivor_entry_id, scoring_period_id, game_id, selected_team_id
    ) values (
      target_survivor_entry_id,
      target_scoring_period_id,
      (replacement_pick ->> 'game_id')::uuid,
      (replacement_pick ->> 'selected_team_id')::uuid
    );
  end if;
end;
$$;
