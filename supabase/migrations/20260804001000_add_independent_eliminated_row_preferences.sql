-- Private display preferences only. These never alter standings, picks, or audit history.
alter table public.players
  add column if not exists hide_pickem_eliminated_rows boolean not null default false,
  add column if not exists hide_survivor_eliminated_rows boolean not null default false;
