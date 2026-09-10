alter table public.players
  add column if not exists show_bowl_card boolean not null default true;
