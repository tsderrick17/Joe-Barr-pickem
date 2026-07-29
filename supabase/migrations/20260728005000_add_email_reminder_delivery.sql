-- Email uses the same schedule and audience filters as browser push, but has
-- independent opt-in controls and receipts.

alter table public.players
  add column if not exists email_weekly_enabled boolean not null default true,
  add column if not exists email_ats_due_enabled boolean not null default true,
  add column if not exists email_survivor_due_enabled boolean not null default true,
  add column if not exists email_custom_enabled boolean not null default true;

create table if not exists public.email_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.push_reminders(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  email_address text not null,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed', 'suppressed')),
  provider_status integer,
  provider_message_id text,
  error_message text,
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (reminder_id, player_id)
);

create index if not exists email_reminder_deliveries_reminder_idx
  on public.email_reminder_deliveries(reminder_id, status);

alter table public.email_reminder_deliveries enable row level security;
revoke all on table public.email_reminder_deliveries from anon, authenticated;
