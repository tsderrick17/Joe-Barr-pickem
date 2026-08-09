-- Kickoff times are operational and may move. A game's pool week is historical
-- identity and must not move with them. Persist the original Tuesday-based
-- gameweek key, then enforce the relationship at every write boundary.
create or replace function public.nfl_gameweek_key(value timestamptz)
returns date
language sql
immutable
strict
set search_path = public
as $$
  select local_day - (((extract(dow from local_day)::integer - 2) + 7) % 7)
  from (select (value at time zone 'America/New_York')::date as local_day) as parts;
$$;

alter table public.games
  add column if not exists gameweek_key date;

update public.games as game
set gameweek_key = coalesce(
  public.nfl_gameweek_key(period.starts_at),
  public.nfl_gameweek_key(game.kickoff_at)
)
from public.scoring_periods as period
where period.id = game.scoring_period_id
  and game.gameweek_key is null;

alter table public.games
  alter column gameweek_key set not null;

create index if not exists games_gameweek_key_idx
  on public.games(gameweek_key, kickoff_at);

create or replace function public.enforce_gameweek_pin()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  period_row public.scoring_periods%rowtype;
  expected_key date;
begin
  if tg_op = 'UPDATE' then
    if new.scoring_period_id is distinct from old.scoring_period_id then
      raise exception 'A game is permanently pinned to its original scoring period.';
    end if;
    if new.gameweek_key is distinct from old.gameweek_key then
      raise exception 'A game is permanently pinned to its original gameweek.';
    end if;
  elsif new.gameweek_key is null then
    new.gameweek_key := public.nfl_gameweek_key(new.kickoff_at);
  end if;

  select * into period_row
  from public.scoring_periods
  where id = new.scoring_period_id;

  if not found then
    raise exception 'The game scoring period does not exist.';
  end if;

  if period_row.starts_at is not null then
    expected_key := public.nfl_gameweek_key(period_row.starts_at);
    if new.gameweek_key <> expected_key then
      raise exception 'The gameweek pin does not match its scoring period.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_gameweek_pin_on_games on public.games;
create trigger enforce_gameweek_pin_on_games
before insert or update of scoring_period_id, gameweek_key on public.games
for each row execute function public.enforce_gameweek_pin();

create or replace function public.prevent_period_window_from_moving_pinned_games()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  revised_key date;
begin
  if new.starts_at is null then
    if exists (select 1 from public.games where scoring_period_id = new.id) then
      raise exception 'A scoring period with pinned games cannot lose its schedule window.';
    end if;
    return new;
  end if;

  revised_key := public.nfl_gameweek_key(new.starts_at);
  if exists (
    select 1 from public.games
    where scoring_period_id = new.id and gameweek_key <> revised_key
  ) then
    raise exception 'The scoring period window would move a pinned game to another gameweek.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_pinned_game_period_window on public.scoring_periods;
create trigger protect_pinned_game_period_window
before update of starts_at, ends_at on public.scoring_periods
for each row execute function public.prevent_period_window_from_moving_pinned_games();

create or replace function public.enforce_pick_gameweek_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  game_period_id uuid;
begin
  select scoring_period_id into game_period_id
  from public.games where id = new.game_id;
  if not found then raise exception 'The selected game does not exist.'; end if;
  if new.scoring_period_id <> game_period_id then
    raise exception 'A pick must use the scoring period permanently pinned to its game.';
  end if;
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.picks as pick
    join public.games as game on game.id = pick.game_id
    where pick.scoring_period_id <> game.scoring_period_id
  ) or exists (
    select 1 from public.survivor_picks as pick
    join public.games as game on game.id = pick.game_id
    where pick.scoring_period_id <> game.scoring_period_id
  ) then
    raise exception 'Existing picks contain a gameweek mismatch; repair them before applying gameweek pins.';
  end if;
end;
$$;

drop trigger if exists enforce_pick_gameweek_on_picks on public.picks;
create trigger enforce_pick_gameweek_on_picks
before insert or update of scoring_period_id, game_id on public.picks
for each row execute function public.enforce_pick_gameweek_consistency();

drop trigger if exists enforce_pick_gameweek_on_survivor_picks on public.survivor_picks;
create trigger enforce_pick_gameweek_on_survivor_picks
before insert or update of scoring_period_id, game_id on public.survivor_picks
for each row execute function public.enforce_pick_gameweek_consistency();

revoke all on function public.nfl_gameweek_key(timestamptz) from public, anon, authenticated;
revoke all on function public.enforce_gameweek_pin() from public, anon, authenticated;
revoke all on function public.prevent_period_window_from_moving_pinned_games() from public, anon, authenticated;
revoke all on function public.enforce_pick_gameweek_consistency() from public, anon, authenticated;
grant execute on function public.nfl_gameweek_key(timestamptz) to service_role;
