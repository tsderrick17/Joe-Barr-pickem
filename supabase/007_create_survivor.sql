create table if not exists public.survivor_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'eliminated', 'complete')),
  entered_at timestamptz not null default now(),
  eliminated_scoring_period_id uuid
    references public.scoring_periods(id),
  eliminated_game_id uuid references public.games(id),
  eliminated_at timestamptz,
  unique (player_id, season_id)
);

create table if not exists public.survivor_picks (
  id uuid primary key default gen_random_uuid(),
  survivor_entry_id uuid not null
    references public.survivor_entries(id) on delete cascade,
  scoring_period_id uuid not null
    references public.scoring_periods(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  selected_team_id uuid not null references public.teams(id),
  submitted_at timestamptz not null default now(),
  locked_at timestamptz,
  result text not null default 'pending'
    check (result in ('pending', 'win', 'loss', 'void')),
  unique (survivor_entry_id, scoring_period_id),
  unique (survivor_entry_id, selected_team_id)
);

alter table public.survivor_entries enable row level security;
alter table public.survivor_picks enable row level security;