-- The pool's own Web Push signing keys (VAPID). The server makes the pair the first time it is needed and keeps it here, so nothing has to be
-- set up in Vercel. One row only. Server-only: no client role can read the private key.
create table if not exists public.push_vapid_keys (
  id boolean primary key default true constraint push_vapid_keys_single_row check (id),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_vapid_keys enable row level security;

revoke all on table public.push_vapid_keys from anon, authenticated;

grant all privileges on public.push_vapid_keys to service_role;
