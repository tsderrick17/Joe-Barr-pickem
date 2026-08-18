-- Recreate every game-critical schedule from migration history. The original
-- production jobs lived in root-level historical SQL and were therefore not
-- reproducible on a fresh project. This migration is intentionally idempotent.

-- BEGIN PRODUCTION CRITICAL SCHEDULES
select cron.unschedule(jobid::integer)
from cron.job
where jobname in (
  'lock-official-lines-every-minute',
  'refresh-final-nfl-scores-every-15-minutes',
  'refresh-nfl-schedule-and-spreads-daily',
  'refresh-nfl-schedule-and-spreads-prelock-early',
  'refresh-nfl-schedule-and-spreads-prelock-standard'
);

select cron.schedule(
  'lock-official-lines-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/lock-lines',
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

select cron.schedule(
  'refresh-final-nfl-scores-every-15-minutes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/sync-scores',
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

-- Two UTC windows cover 7 AM Eastern before the 8 AM line lock across both
-- daylight and standard time. The endpoint is idempotent and lease protected.
select cron.schedule(
  'refresh-nfl-schedule-and-spreads-prelock-early',
  '0 11 * 1,2,8,9,10,11,12 *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/admin/import-games',
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

select cron.schedule(
  'refresh-nfl-schedule-and-spreads-prelock-standard',
  '0 12 * 1,2,8,9,10,11,12 *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/admin/import-games',
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
-- END PRODUCTION CRITICAL SCHEDULES

-- Verify the complete job definition, not merely the presence of a familiar
-- name. This catches an inactive job, wrong cadence, old URL, or missing auth.
create or replace function public.automation_preflight()
returns table(check_id text, label text, passed boolean, detail text)
language sql
security definer
set search_path = public, cron, vault
as $$
  with required_jobs(job_name, job_label, expected_schedule, expected_path) as (
    values
      ('lock-official-lines-every-minute', 'Official line lock every minute', '* * * * *', '/api/cron/lock-lines'),
      ('refresh-nfl-schedule-and-spreads-prelock-early', 'Pre-lock spread refresh (daylight-safe)', '0 11 * 1,2,8,9,10,11,12 *', '/api/admin/import-games'),
      ('refresh-nfl-schedule-and-spreads-prelock-standard', 'Pre-lock spread refresh (standard-safe)', '0 12 * 1,2,8,9,10,11,12 *', '/api/admin/import-games'),
      ('refresh-final-nfl-scores-every-15-minutes', 'Final score refresh every 15 minutes', '*/15 * * * *', '/api/cron/sync-scores'),
      ('send-pickem-browser-reminders-every-five-minutes', 'Reminder delivery every five minutes', '*/5 * * * *', '/api/cron/send-reminders'),
      ('bootstrap-full-nfl-season-daily', 'Automatic preseason schedule bootstrap', '15 12 * 8,9 *', '/api/cron/bootstrap-season'),
      ('pickem-operations-watchdog-every-five-minutes', 'Operations watchdog every five minutes', '*/5 * * * *', '/api/cron/watchdog')
  ), inspected as (
    select required_jobs.*,
      exists (
        select 1 from cron.job
        where jobname = required_jobs.job_name
          and active
          and schedule = required_jobs.expected_schedule
          and command like '%' || required_jobs.expected_path || '%'
          and command like '%Authorization%'
          and command like '%cron_secret%'
      ) as is_correct
    from required_jobs
  )
  select
    'cron-' || job_name,
    job_label,
    is_correct,
    case when is_correct
      then 'Active with the expected cadence, endpoint, and Vault authorization.'
      else 'Missing, inactive, or different from the required cadence, endpoint, or authorization.' end
  from inspected
  union all
  select
    'cron-secret',
    'Supabase Vault automation secret',
    exists(select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret <> ''),
    case when exists(select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret <> '')
      then 'Supabase has a non-empty cron_secret for scheduled requests.'
      else 'The Supabase Vault secret cron_secret is missing or empty.' end;
$$;

-- The application can prove that its CRON_SECRET matches the Vault value
-- without either value ever appearing in a response or log.
create or replace function public.automation_cron_secret_matches(candidate_secret text)
returns boolean
language sql
stable
security definer
set search_path = public, vault
as $$
  select candidate_secret is not null
    and candidate_secret <> ''
    and exists (
      select 1 from vault.decrypted_secrets
      where name = 'cron_secret' and decrypted_secret = candidate_secret
    );
$$;

revoke all on function public.automation_preflight() from public, anon, authenticated;
revoke all on function public.automation_cron_secret_matches(text) from public, anon, authenticated;
grant execute on function public.automation_preflight() to service_role;
grant execute on function public.automation_cron_secret_matches(text) to service_role;
