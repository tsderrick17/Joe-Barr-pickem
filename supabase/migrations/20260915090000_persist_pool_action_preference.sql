alter table public.players
  add column if not exists show_pool_action boolean not null default false;
