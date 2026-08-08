-- Player-controlled reminder categories, Commissioner schedules, and an
-- append-only delivery receipt make browser push useful without exposing picks.

alter table public.players
  add column if not exists push_weekly_enabled boolean not null default true,
  add column if not exists push_ats_due_enabled boolean not null default true,
  add column if not exists push_survivor_due_enabled boolean not null default true,
  add column if not exists push_custom_enabled boolean not null default true;

create table if not exists public.push_reminders (
  id uuid primary key default gen_random_uuid(),
  created_by_player_id uuid not null references public.players(id),
  category text not null check (category in ('weekly', 'ats_due', 'survivor_due', 'custom')),
  audience text not null check (audience in ('all_active', 'ats_due', 'survivor_due')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 220),
  scheduled_for timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sending', 'sent', 'cancelled', 'test')),
  processing_started_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_reminders_due_idx
  on public.push_reminders(status, scheduled_for);

create table if not exists public.push_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.push_reminders(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed', 'expired')),
  provider_status integer,
  error_message text,
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (reminder_id, subscription_id)
);

create index if not exists push_reminder_deliveries_reminder_idx
  on public.push_reminder_deliveries(reminder_id, status);

alter table public.push_reminders enable row level security;
alter table public.push_reminder_deliveries enable row level security;
revoke all on table public.push_reminders, public.push_reminder_deliveries from anon, authenticated;

-- Claims work in a transaction so cron retries cannot send the same scheduled
-- reminder twice. A stale sending row is intentionally surfaced to the
-- Commissioner rather than silently sending a duplicate.
create or replace function public.claim_due_push_reminders()
returns setof public.push_reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select id
    from public.push_reminders
    where status = 'scheduled'
      and scheduled_for <= clock_timestamp()
    order by scheduled_for, created_at
    for update skip locked
  )
  update public.push_reminders reminders
  set status = 'sending', processing_started_at = clock_timestamp(), updated_at = clock_timestamp()
  from due
  where reminders.id = due.id
  returning reminders.*;
end;
$$;

revoke all on function public.claim_due_push_reminders() from public;
grant execute on function public.claim_due_push_reminders() to service_role;

-- Expand the existing automation lease to include scheduled reminder delivery.
alter table public.automation_execution_leases
  drop constraint if exists automation_execution_leases_job_name_check;
alter table public.automation_execution_leases
  add constraint automation_execution_leases_job_name_check
  check (job_name in ('line_locks', 'scores', 'reminders'));

create or replace function public.claim_automation_execution_lease(
  target_job_name text,
  lease_seconds integer default 120
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token uuid := gen_random_uuid();
  acquired_token uuid;
begin
  if target_job_name not in ('line_locks', 'scores', 'reminders') or lease_seconds not between 30 and 600 then
    raise exception 'Invalid automation lease request.';
  end if;

  insert into public.automation_execution_leases (job_name, token, acquired_at, locked_until)
  values (target_job_name, new_token, clock_timestamp(), clock_timestamp() + make_interval(secs => lease_seconds))
  on conflict (job_name) do update
    set token = excluded.token,
        acquired_at = excluded.acquired_at,
        locked_until = excluded.locked_until
  where public.automation_execution_leases.locked_until <= clock_timestamp()
  returning token into acquired_token;

  return acquired_token;
end;
$$;

-- A five-minute check makes Commissioner-selected times flexible without a
-- paid scheduler. It is idle until a reminder is explicitly scheduled.
select cron.unschedule(jobid::integer)
from cron.job
where jobname = 'send-pickem-browser-reminders-every-five-minutes';

select cron.schedule(
  'send-pickem-browser-reminders-every-five-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

create or replace function public.automation_preflight()
returns table(check_id text, label text, passed boolean, detail text)
language sql
security definer
set search_path = public, cron, vault
as $$
  with required_jobs(job_name, job_label) as (
    values
      ('lock-official-lines-every-minute', 'Official line lock every minute'),
      ('refresh-nfl-schedule-and-spreads-prelock-early', 'Pre-lock schedule refresh (early)'),
      ('refresh-nfl-schedule-and-spreads-prelock-standard', 'Pre-lock schedule refresh (standard)'),
      ('refresh-final-nfl-scores-every-15-minutes', 'Final score refresh every 15 minutes'),
      ('send-pickem-browser-reminders-every-five-minutes', 'Browser reminder delivery every five minutes')
  )
  select
    'cron-' || required_jobs.job_name,
    required_jobs.job_label,
    exists(select 1 from cron.job where jobname = required_jobs.job_name and active),
    case when exists(select 1 from cron.job where jobname = required_jobs.job_name and active)
      then 'Scheduled and active.' else 'Missing or inactive.' end
  from required_jobs
  union all
  select
    'cron-secret',
    'Shared automation secret',
    exists(select 1 from vault.decrypted_secrets where name = 'cron_secret'),
    case when exists(select 1 from vault.decrypted_secrets where name = 'cron_secret')
      then 'Supabase can authenticate scheduled requests.' else 'The vault secret cron_secret is missing.' end;
$$;
