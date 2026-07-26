create table if not exists public.spread_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  favorite_team_id uuid references public.teams(id),
  spread numeric(4, 1) not null check (spread >= 0),
  source text not null,
  captured_at timestamptz not null default now()
);

create table if not exists public.game_lines (
  game_id uuid primary key references public.games(id) on delete cascade,
  favorite_team_id uuid references public.teams(id),
  locked_spread numeric(4, 1) not null check (locked_spread >= 0),
  source text not null,
  source_captured_at timestamptz not null,
  locked_at timestamptz not null default now(),
  manual_override boolean not null default false
);

alter table public.spread_history enable row level security;
alter table public.game_lines enable row level security;