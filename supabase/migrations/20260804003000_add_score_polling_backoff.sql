-- Keep a delayed final from consuming score-provider credits every 15 minutes.
-- This is operational state only; the immutable game, pick, and audit records
-- remain untouched.
create table if not exists public.score_check_backoff (
  game_id uuid primary key references public.games(id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  last_checked_at timestamptz not null default now(),
  next_check_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists score_check_backoff_due_idx
  on public.score_check_backoff(next_check_at);

alter table public.score_check_backoff enable row level security;
revoke all on table public.score_check_backoff from anon, authenticated;
