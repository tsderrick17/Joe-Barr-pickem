create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_player_id uuid references public.players(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;