-- A coarse Commissioner-only activity indicator. It deliberately contains no
-- screen, pick, device, or location data.
alter table public.players
  add column if not exists last_active_at timestamptz;

create index if not exists players_last_active_at_idx
  on public.players (last_active_at desc nulls last);
