create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  job_type text not null
    check (job_type in ('schedule', 'odds', 'scores')),
  status text not null
    check (status in ('started', 'success', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  error_message text
);

alter table public.sync_runs enable row level security;
