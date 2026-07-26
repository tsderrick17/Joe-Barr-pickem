create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  external_game_id text not null unique,
  scoring_period_id uuid not null
    references public.scoring_periods(id) on delete cascade,
  away_team_id uuid not null
    references public.teams(id),
  home_team_id uuid not null
    references public.teams(id),
  kickoff_at timestamptz not null,
  line_lock_at timestamptz not null,
  venue_name text,
  venue_city text,
  venue_country text,
  is_neutral_site boolean not null default false,
  is_international boolean not null default false,
  game_note text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'final', 'postponed', 'cancelled')),
  away_score integer,
  home_score integer,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;