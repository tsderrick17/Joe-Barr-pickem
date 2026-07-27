-- Read-only Commissioner preflight for Supabase cron configuration.
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
      ('refresh-final-nfl-scores-every-15-minutes', 'Final score refresh every 15 minutes')
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

revoke all on function public.automation_preflight() from public;
grant execute on function public.automation_preflight() to service_role;
