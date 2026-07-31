-- A lightweight, season-scoped conversation space.  The application uses the
-- server-side client after authenticating the player, while RLS keeps this
-- table unavailable to anonymous browser access.
create table if not exists public.pool_chat_messages (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists pool_chat_messages_season_created_idx
  on public.pool_chat_messages (season_id, created_at desc);

alter table public.pool_chat_messages enable row level security;
