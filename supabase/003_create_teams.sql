create table public.teams (
  id uuid primary key default gen_random_uuid(),
  abbreviation text not null unique,
  city text not null,
  mascot text not null,
  full_name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;