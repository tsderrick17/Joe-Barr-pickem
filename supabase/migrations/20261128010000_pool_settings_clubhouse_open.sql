-- Pool-wide switches the Commissioner sets from the site. One row only. Today: whether the clubhouse (the light switch in the header and
-- /clubhouse) is open to every player, not only the Commissioner and the players let into its beta. Off until the Commissioner turns it on.
-- Server-only: no client role can read or change it.
create table if not exists public.pool_settings (
  id boolean primary key default true constraint pool_settings_single_row check (id),
  clubhouse_open boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.pool_settings (id) values (true) on conflict (id) do nothing;

alter table public.pool_settings enable row level security;

revoke all on table public.pool_settings from anon, authenticated;

grant all privileges on public.pool_settings to service_role;
