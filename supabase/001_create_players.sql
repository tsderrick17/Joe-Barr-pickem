create table public.players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null unique,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_commissioner boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;