-- Call the Vercel reminder worker only when claim_due_push_reminders() would
-- have work: a scheduled reminder that is due, or a stale "sending" claim it
-- would return to the queue. Idle five-minute ticks stay inside Supabase.

create or replace function public.reminder_delivery_is_due()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    exists (
      select 1 from public.push_reminders reminder
      where reminder.status = 'scheduled'
        and reminder.scheduled_for <= clock_timestamp()
    )
    or exists (
      select 1 from public.push_reminders reminder
      where reminder.status = 'sending'
        and reminder.processing_started_at < clock_timestamp() - interval '20 minutes'
        and not exists (
          select 1 from public.email_reminder_deliveries delivery
          where delivery.reminder_id = reminder.id
        )
    );
$$;

create or replace function public.dispatch_reminders_if_due()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, net, vault
as $$
declare
  shared_secret text;
  request_id bigint;
begin
  if not public.reminder_delivery_is_due() then return false; end if;
  select decrypted_secret into shared_secret
  from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if coalesce(shared_secret, '') = '' then raise exception 'The automation secret is missing.'; end if;
  request_id := net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || shared_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  return request_id is not null;
end;
$$;

revoke all on function public.reminder_delivery_is_due() from public, anon, authenticated;
revoke all on function public.dispatch_reminders_if_due() from public, anon, authenticated;
grant execute on function public.reminder_delivery_is_due() to service_role;
grant execute on function public.dispatch_reminders_if_due() to service_role;

-- Production exposes pg_cron helper functions; isolated rehearsal databases do not.
do $migration$
declare
  job record;
begin
  for job in select jobid from cron.job where jobname = 'send-pickem-browser-reminders-every-five-minutes' loop
    if to_regprocedure('cron.unschedule(integer)') is not null then
      perform cron.unschedule(job.jobid::integer);
    elsif to_regprocedure('cron.unschedule(bigint)') is not null then
      perform cron.unschedule(job.jobid);
    end if;
  end loop;

  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('send-pickem-browser-reminders-every-five-minutes', '*/5 * * * *', 'select public.dispatch_reminders_if_due();');
  elsif to_regprocedure('cron.schedule(text,text)') is not null then
    perform cron.schedule('*/5 * * * *', 'select public.dispatch_reminders_if_due();');
  end if;
end
$migration$;

-- Preflight now expects the gated reminder dispatcher.
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
      ('pickem-operations-watchdog-every-five-minutes', 'Operations watchdog every five minutes', '*/5 * * * *', '/api/cron/watchdog', null::text)
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
