-- Keep score workers responsive without changing the retry ladders or Bowl Pool cadence.
-- The endpoint remains due-work gated, lease protected, and quota protected.

do $migration$
declare
  command_text text := $command$
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
  $command$;
begin
  -- Production exposes pg_cron helper functions; isolated rehearsal databases do not.
  -- Keep rehearsals migration-safe while using the supported helper overload in production.
  if to_regprocedure('cron.unschedule(integer)') is not null then
    execute $sql$
      select cron.unschedule(jobid::integer)
      from cron.job
      where jobname in (
        'refresh-final-nfl-scores-every-15-minutes',
        'refresh-final-nfl-scores-every-five-minutes',
        'refresh-final-nfl-scores-every-ten-minutes'
      )
    $sql$;
  elsif to_regprocedure('cron.unschedule(bigint)') is not null then
    execute $sql$
      select cron.unschedule(jobid)
      from cron.job
      where jobname in (
        'refresh-final-nfl-scores-every-15-minutes',
        'refresh-final-nfl-scores-every-five-minutes',
        'refresh-final-nfl-scores-every-ten-minutes'
      )
    $sql$;
  end if;

  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute format(
      'select cron.schedule(%L, %L, %L)',
      'refresh-final-nfl-scores-every-ten-minutes',
      '*/10 * * * *',
      command_text
    );
  elsif to_regprocedure('cron.schedule(text,text)') is not null then
    execute format(
      'select cron.schedule(%L, %L)',
      '*/10 * * * *',
      command_text
    );
  end if;
end
$migration$;

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
      ('refresh-final-nfl-scores-every-ten-minutes', 'Final score worker every ten minutes', '*/10 * * * *', '/api/cron/sync-scores'),
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
  select 'cron-' || job_name, job_label, is_correct,
    case when is_correct then 'Active with the expected cadence, endpoint, and Vault authorization.'
      else 'Missing, inactive, or different from the required cadence, endpoint, or authorization.' end
  from inspected
  union all
  select 'cron-secret', 'Supabase Vault automation secret',
    exists(select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret <> ''),
    case when exists(select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret <> '')
      then 'Supabase has a non-empty cron_secret for scheduled requests.'
      else 'The Supabase Vault secret cron_secret is missing or empty.' end;
$$;

revoke all on function public.automation_preflight() from public, anon, authenticated;
grant execute on function public.automation_preflight() to service_role;
