-- Run the operations watchdog every ten minutes instead of five to stay inside
-- the Vercel Fluid active-CPU allowance. The public automation heartbeat
-- allows 35 minutes, so a ten-minute cadence still leaves three missed runs of
-- slack before the monitor fails.

-- Production exposes pg_cron helper functions; isolated rehearsal databases do not.
do $migration$
declare
  job record;
  command_text text := $job$select net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );$job$;
begin
  for job in select jobid from cron.job where jobname in (
    'pickem-operations-watchdog-every-five-minutes',
    'pickem-operations-watchdog-every-ten-minutes'
  ) loop
    if to_regprocedure('cron.unschedule(integer)') is not null then
      perform cron.unschedule(job.jobid::integer);
    elsif to_regprocedure('cron.unschedule(bigint)') is not null then
      perform cron.unschedule(job.jobid);
    end if;
  end loop;

  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('pickem-operations-watchdog-every-ten-minutes', '*/10 * * * *', command_text);
  elsif to_regprocedure('cron.schedule(text,text)') is not null then
    perform cron.schedule('*/10 * * * *', command_text);
  end if;
end
$migration$;

-- Preflight now expects the ten-minute watchdog.
create or replace function public.automation_preflight()
returns table(check_id text, label text, passed boolean, detail text)
language sql security definer set search_path = public, cron, vault, pg_catalog as $$
  with required_jobs(job_name, job_label, expected_schedule, expected_marker, helper_name) as (
    values
      ('lock-official-lines-every-minute', 'Official line lock: gated every minute', '* * * * *', 'dispatch_line_lock_if_due', 'dispatch_line_lock_if_due'),
      ('refresh-nfl-schedule-and-spreads-prelock-early', 'Pre-lock spread refresh (daylight-safe)', '0 11 * 1,2,8,9,10,11,12 *', '/api/admin/import-games', null::text),
      ('refresh-nfl-schedule-and-spreads-prelock-standard', 'Pre-lock spread refresh (standard-safe)', '0 12 * 1,2,8,9,10,11,12 *', '/api/admin/import-games', null::text),
      ('refresh-final-nfl-scores-every-ten-minutes', 'Final score worker every ten minutes', '*/10 * * * *', '/api/cron/sync-scores', null::text),
      ('refresh-bowl-pool-every-fifteen-minutes', 'Bowl Pool adaptive dispatch gate (15-minute ceiling)', '*/15 * * * *', 'dispatch_bowl_sync_if_due', 'dispatch_bowl_sync_if_due'),
      ('send-pickem-browser-reminders-every-five-minutes', 'Reminder delivery: gated every five minutes', '*/5 * * * *', 'dispatch_reminders_if_due', 'dispatch_reminders_if_due'),
      ('reconcile-pickem-email-schedule-every-fifteen-minutes', 'Email schedule reconciliation every fifteen minutes', '*/15 * * * *', '/api/cron/maintain-reminders', null::text),
      ('bootstrap-full-nfl-season-daily', 'Automatic preseason schedule bootstrap', '15 12 * 8,9 *', '/api/cron/bootstrap-season', null::text),
      ('pickem-operations-watchdog-every-ten-minutes', 'Operations watchdog every ten minutes', '*/10 * * * *', '/api/cron/watchdog', null::text)
  ), inspected as (
    select required_jobs.*,
      exists (
        select 1 from cron.job
        where jobname = required_jobs.job_name and active
          and schedule = required_jobs.expected_schedule
          and command like '%' || required_jobs.expected_marker || '%'
          and (
            (required_jobs.helper_name is null and command like '%Authorization%' and command like '%cron_secret%')
            or exists (
              select 1 from pg_catalog.pg_proc helper
              where helper.pronamespace = 'public'::regnamespace
                and helper.proname = required_jobs.helper_name
                and pg_catalog.pg_get_functiondef(helper.oid) like '%net.http_post%'
                and pg_catalog.pg_get_functiondef(helper.oid) like '%decrypted_secrets%'
            )
          )
      ) as is_correct
    from required_jobs
  )
  select 'cron-' || job_name, job_label, is_correct,
    case when is_correct then 'Active with the expected cadence, gate, endpoint, and Vault authorization.'
      else 'Missing, inactive, or different from the required cadence, gate, endpoint, or authorization.' end
  from inspected
  union all
  select 'cron-secret', 'Supabase Vault automation secret',
    exists(select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret <> ''),
    case when exists(select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret <> '')
      then 'Supabase has a non-empty cron_secret for scheduled requests.'
      else 'The vault secret cron_secret is missing or empty.' end;
$$;

revoke all on function public.automation_preflight() from public, anon, authenticated;
grant execute on function public.automation_preflight() to service_role;
