create unique index if not exists picks_one_game_per_player
on public.picks (player_id, scoring_period_id, game_id);

create or replace function public.validate_pick()
returns trigger
language plpgsql
as $$
declare
  game_period_id uuid;
  game_away_team_id uuid;
  game_home_team_id uuid;
  game_lock_at timestamptz;
  allowed_pick_count integer;
  existing_pick_count integer;
begin
  select
    scoring_period_id,
    away_team_id,
    home_team_id,
    line_lock_at
  into
    game_period_id,
    game_away_team_id,
    game_home_team_id,
    game_lock_at
  from public.games
  where id = new.game_id;

  if game_period_id is null then
    raise exception 'The selected game does not exist.';
  end if;

  if new.scoring_period_id is distinct from game_period_id then
    raise exception 'A pick must belong to the game''s assigned week.';
  end if;

  if new.selected_team_id not in (game_away_team_id, game_home_team_id) then
    raise exception 'A pick must select one of the two teams in that game.';
  end if;

  if now() >= game_lock_at then
    raise exception 'That game is already locked.';
  end if;

  select max_picks
  into allowed_pick_count
  from public.scoring_periods
  where id = new.scoring_period_id;

  select count(*)
  into existing_pick_count
  from public.picks
  where player_id = new.player_id
    and scoring_period_id = new.scoring_period_id
    and id is distinct from new.id;

  if existing_pick_count >= allowed_pick_count then
    raise exception 'This player already has the maximum number of picks for the week.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_pick on public.picks;

create trigger validate_pick
before insert or update of game_id, selected_team_id, scoring_period_id
on public.picks
for each row
execute function public.validate_pick();