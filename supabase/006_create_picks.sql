create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  scoring_period_id uuid not null
    references public.scoring_periods(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  selected_team_id uuid not null references public.teams(id),
  submitted_at timestamptz not null default now(),
  locked_at timestamptz,
  result text not null default 'pending'
    check (result in ('pending', 'win', 'loss', 'void')),
  replaces_pick_id uuid references public.picks(id),
  unique (player_id, game_id),
  unique (player_id, scoring_period_id, selected_team_id)
);

create table if not exists public.pick_history (
  id uuid primary key default gen_random_uuid(),
  pick_id uuid not null references public.picks(id) on delete cascade,
  actor_player_id uuid references public.players(id),
  action text not null
    check (action in ('created', 'changed', 'reopened', 'voided', 'replacement')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.picks enable row level security;
alter table public.pick_history enable row level security;