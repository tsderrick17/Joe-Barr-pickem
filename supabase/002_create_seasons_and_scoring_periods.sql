create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  state text not null default 'preseason'
    check (state in ('offseason', 'preseason', 'regular_season', 'playoffs', 'complete')),
  created_at timestamptz not null default now()
);

create table public.scoring_periods (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  display_name text not null,
  period_type text not null
    check (period_type in ('regular', 'playoff')),
  max_picks integer not null check (max_picks > 0),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'active', 'complete')),
  display_order integer not null,
  created_at timestamptz not null default now(),
  unique (season_id, display_order)
);

alter table public.seasons enable row level security;
alter table public.scoring_periods enable row level security;