-- Separate, voluntary annual NCAA bowl pool. This deliberately does not reuse
-- NFL season, game, pick, or team tables: its entry rules and scoring window
-- are independent, while its historical record remains durable.

create table if not exists public.bowl_pool_seasons (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null unique check (season_year >= 2026),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'open', 'live', 'complete')),
  player_visible_at timestamptz not null,
  first_kickoff_at timestamptz,
  championship_game_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.bowl_pool_teams (
  id uuid primary key default gen_random_uuid(),
  provider_team_id text not null unique,
  display_name text not null unique,
  short_name text not null,
  abbreviation text,
  conference_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bowl_pool_games (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.bowl_pool_seasons(id) on delete restrict,
  provider_game_id text not null unique,
  odds_event_id text unique,
  bowl_name text not null,
  is_cfp boolean not null default false,
  -- Selection Sunday establishes the bowl row before the participants are
  -- known. Team identities are filled by the annual schedule sync later.
  away_team_id uuid references public.bowl_pool_teams(id),
  home_team_id uuid references public.bowl_pool_teams(id),
  kickoff_at timestamptz not null,
  line_lock_at timestamptz not null,
  venue_name text,
  venue_city text,
  venue_state text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'final', 'postponed', 'cancelled', 'no_contest')),
  away_score integer,
  home_score integer,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  check (away_team_id is null or home_team_id is null or away_team_id <> home_team_id),
  check (line_lock_at <= kickoff_at)
);

alter table public.bowl_pool_seasons
  drop constraint if exists bowl_pool_seasons_championship_game_id_fkey;
alter table public.bowl_pool_seasons
  add constraint bowl_pool_seasons_championship_game_id_fkey
  foreign key (championship_game_id) references public.bowl_pool_games(id) on delete restrict;

create index if not exists bowl_pool_games_season_kickoff_idx
  on public.bowl_pool_games(season_id, kickoff_at);
create index if not exists bowl_pool_games_due_line_lock_idx
  on public.bowl_pool_games(status, line_lock_at);

create or replace function public.refresh_bowl_pool_first_kickoff()
returns trigger
language plpgsql
set search_path = public
as $$
declare affected_season_id uuid := coalesce(new.season_id, old.season_id);
begin
  update public.bowl_pool_seasons season
  set first_kickoff_at = (
    select min(game.kickoff_at)
    from public.bowl_pool_games game
    where game.season_id = affected_season_id
  )
  where season.id = affected_season_id;
  return null;
end;
$$;

drop trigger if exists refresh_bowl_pool_first_kickoff_after_game_write on public.bowl_pool_games;
create trigger refresh_bowl_pool_first_kickoff_after_game_write
after insert or update of season_id, kickoff_at or delete on public.bowl_pool_games
for each row execute function public.refresh_bowl_pool_first_kickoff();

create table if not exists public.bowl_pool_spread_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.bowl_pool_games(id) on delete cascade,
  favorite_team_id uuid references public.bowl_pool_teams(id),
  source_spread numeric(5, 1) not null check (source_spread >= 0),
  pool_spread numeric(5, 1) not null check (pool_spread >= 0),
  source text not null,
  captured_at timestamptz not null default now(),
  check ((source_spread = 0 and pool_spread = 0) or (source_spread > 0 and pool_spread > 0))
);

create table if not exists public.bowl_pool_game_lines (
  game_id uuid primary key references public.bowl_pool_games(id) on delete cascade,
  favorite_team_id uuid references public.bowl_pool_teams(id),
  source_spread numeric(5, 1) not null check (source_spread >= 0),
  locked_spread numeric(5, 1) not null check (locked_spread >= 0),
  source text not null,
  source_captured_at timestamptz not null,
  locked_at timestamptz not null default now(),
  manual_override boolean not null default false,
  check ((source_spread = 0 and locked_spread = 0) or (source_spread > 0 and locked_spread > 0))
);

create table if not exists public.bowl_pool_entries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.bowl_pool_seasons(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'withdrawn', 'complete')),
  opted_in_at timestamptz not null default now(),
  opted_out_at timestamptz,
  championship_total_guess integer check (championship_total_guess between 0 and 200),
  championship_total_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (season_id, player_id),
  check ((status = 'withdrawn') = (opted_out_at is not null))
);

create index if not exists bowl_pool_entries_season_status_idx
  on public.bowl_pool_entries(season_id, status);

create table if not exists public.bowl_pool_picks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.bowl_pool_entries(id) on delete cascade,
  game_id uuid not null references public.bowl_pool_games(id) on delete restrict,
  selected_team_id uuid not null references public.bowl_pool_teams(id),
  submitted_at timestamptz not null default now(),
  result text not null default 'pending' check (result in ('pending', 'win', 'loss', 'void')),
  graded_at timestamptz,
  unique(entry_id, game_id)
);

create table if not exists public.bowl_pool_pick_history (
  id uuid primary key default gen_random_uuid(),
  pick_id uuid references public.bowl_pool_picks(id) on delete set null,
  entry_id uuid not null references public.bowl_pool_entries(id) on delete restrict,
  actor_player_id uuid references public.players(id) on delete set null,
  action text not null check (action in ('created', 'changed', 'cleared', 'voided', 'graded')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bowl_pool_championships (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.bowl_pool_seasons(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  wins integer not null check (wins >= 0),
  championship_total_guess integer not null check (championship_total_guess between 0 and 200),
  final_total_difference integer not null check (final_total_difference >= 0),
  created_at timestamptz not null default now(),
  unique(season_id, player_id)
);

create or replace function public.normalize_bowl_pool_spread(raw_spread numeric)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when raw_spread is null or raw_spread < 0 then null
    when raw_spread = 0 then 0
    when raw_spread = trunc(raw_spread) then raw_spread + 0.5
    else raw_spread
  end;
$$;

create or replace function public.validate_bowl_pool_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  season_row public.bowl_pool_seasons%rowtype;
  championship_kickoff_at timestamptz;
begin
  select * into season_row from public.bowl_pool_seasons where id = new.season_id;
  if not found then raise exception 'That bowl pool season does not exist.'; end if;
  if not exists (select 1 from public.players where id = new.player_id and active) then
    raise exception 'Only an active pool player may enter the bowl pool.';
  end if;
  if new.status = 'active' and clock_timestamp() < season_row.player_visible_at and not exists (
    select 1 from public.players where id = new.player_id and is_commissioner
  ) then
    raise exception 'Bowl-pool entry opens December 7 at 3:00 AM Eastern.';
  end if;
  if new.status = 'active' and season_row.first_kickoff_at is not null
    and clock_timestamp() >= season_row.first_kickoff_at
    and (tg_op = 'INSERT' or old.status = 'withdrawn') then
    raise exception 'Bowl-pool entry closes at the first kickoff.';
  end if;
  if new.status = 'withdrawn' and season_row.first_kickoff_at is not null and clock_timestamp() >= season_row.first_kickoff_at then
    raise exception 'Bowl-pool entries close at the first kickoff.';
  end if;
  if new.championship_total_guess is distinct from (
    case when tg_op = 'INSERT' then null else old.championship_total_guess end
  )
    and season_row.championship_game_id is not null then
    select kickoff_at into championship_kickoff_at from public.bowl_pool_games where id = season_row.championship_game_id;
    if championship_kickoff_at is not null and clock_timestamp() >= championship_kickoff_at then
      raise exception 'The championship total prediction locks at kickoff.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_bowl_pool_pick()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  entry_row public.bowl_pool_entries%rowtype;
  game_row public.bowl_pool_games%rowtype;
begin
  select * into entry_row from public.bowl_pool_entries where id = new.entry_id;
  select * into game_row from public.bowl_pool_games where id = new.game_id;
  if not found then raise exception 'That bowl game does not exist.'; end if;
  if entry_row.status <> 'active' then raise exception 'This bowl-pool entry is not active.'; end if;
  if entry_row.season_id <> game_row.season_id then raise exception 'A bowl pick must belong to its own season.'; end if;
  if game_row.status <> 'scheduled' or clock_timestamp() >= game_row.kickoff_at then
    raise exception 'That bowl game is no longer open for selections.';
  end if;
  if game_row.away_team_id is null or game_row.home_team_id is null
    or new.selected_team_id not in (game_row.away_team_id, game_row.home_team_id) then
    raise exception 'A bowl pick must select one of the two teams in that game.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_bowl_pool_entry_before_write on public.bowl_pool_entries;
create trigger validate_bowl_pool_entry_before_write
before insert or update of status, season_id, player_id, championship_total_guess on public.bowl_pool_entries
for each row execute function public.validate_bowl_pool_entry();

drop trigger if exists validate_bowl_pool_pick_before_write on public.bowl_pool_picks;
create trigger validate_bowl_pool_pick_before_write
before insert or update of entry_id, game_id, selected_team_id on public.bowl_pool_picks
for each row execute function public.validate_bowl_pool_pick();

-- A withdrawn pre-event entry keeps its private draft during the opt-out
-- window, then the first game-start pass removes the draft permanently.
create or replace function public.purge_withdrawn_bowl_pool_drafts(evaluated_at timestamptz default clock_timestamp())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare deleted_count integer := 0;
begin
  delete from public.bowl_pool_picks pick
  using public.bowl_pool_entries entry, public.bowl_pool_seasons season
  where pick.entry_id = entry.id
    and entry.season_id = season.id
    and entry.status = 'withdrawn'
    and season.first_kickoff_at is not null
    and season.first_kickoff_at <= evaluated_at;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_withdrawn_bowl_pool_drafts(timestamptz) from public, anon, authenticated;
grant execute on function public.purge_withdrawn_bowl_pool_drafts(timestamptz) to service_role;

alter table public.bowl_pool_seasons enable row level security;
alter table public.bowl_pool_teams enable row level security;
alter table public.bowl_pool_games enable row level security;
alter table public.bowl_pool_spread_history enable row level security;
alter table public.bowl_pool_game_lines enable row level security;
alter table public.bowl_pool_entries enable row level security;
alter table public.bowl_pool_picks enable row level security;
alter table public.bowl_pool_pick_history enable row level security;
alter table public.bowl_pool_championships enable row level security;

revoke all on table public.bowl_pool_seasons, public.bowl_pool_teams, public.bowl_pool_games,
  public.bowl_pool_spread_history, public.bowl_pool_game_lines, public.bowl_pool_entries,
  public.bowl_pool_picks, public.bowl_pool_pick_history, public.bowl_pool_championships
  from public, anon, authenticated;
grant all on table public.bowl_pool_seasons, public.bowl_pool_teams, public.bowl_pool_games,
  public.bowl_pool_spread_history, public.bowl_pool_game_lines, public.bowl_pool_entries,
  public.bowl_pool_picks, public.bowl_pool_pick_history, public.bowl_pool_championships
  to service_role;
