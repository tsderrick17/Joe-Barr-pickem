-- What the Players page shows about each player: where they were last seen (device, browser, and whether it was the installed app), whether they
-- have ever opened the installed app, and which days they visited (one row per player per Eastern day, so a week's visits are a count of up to seven
-- rows). Labels only: the server turns the browser's User-Agent into a short fixed label and stores that, never the raw text.
alter table public.players
  add column if not exists last_device text check (char_length(last_device) <= 30),
  add column if not exists last_browser text check (char_length(last_browser) <= 30),
  add column if not exists last_via_app boolean,
  add column if not exists app_seen_at timestamptz;

create table if not exists public.player_visit_days (
  player_id uuid not null references public.players(id) on delete cascade,
  day date not null,
  primary key (player_id, day)
);

create index if not exists player_visit_days_day_idx on public.player_visit_days (day);

alter table public.player_visit_days enable row level security;

revoke all on table public.player_visit_days from anon, authenticated;

grant all privileges on public.player_visit_days to service_role;
