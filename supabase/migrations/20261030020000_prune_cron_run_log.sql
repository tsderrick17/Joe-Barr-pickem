-- pg_cron records every run in cron.job_run_details and never removes them. The
-- every-minute line-lock gate and the other schedules add about 2,200 rows a
-- day: by 2026-10-30 the log held 113 MB of the database's 160 MB (the Free plan
-- allows 500 MB). The weekly operational cleanup now keeps the last 7 days.
--
-- Production has the cron schema; isolated rehearsal databases may not, so the
-- log is reached through dynamic SQL only when it exists. A missing privilege is
-- reported as a warning instead of failing the weekly cleanup or the annual
-- turnover that calls it.

create or replace function public.prune_operational_storage(
  reference_time timestamptz default clock_timestamp()
)
returns table(record_type text, deleted_count bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  retention_cutoff timestamptz := reference_time - interval '180 days';
  cron_log_cutoff timestamptz := reference_time - interval '7 days';
  sync_runs_deleted bigint := 0;
  resolved_alerts_deleted bigint := 0;
  resolved_reviews_deleted bigint := 0;
  cron_runs_deleted bigint := 0;
begin
  delete from public.sync_runs
  where started_at < retention_cutoff;
  get diagnostics sync_runs_deleted = row_count;

  delete from public.automation_alerts
  where resolved_at is not null and resolved_at < retention_cutoff;
  get diagnostics resolved_alerts_deleted = row_count;

  delete from public.schedule_change_reviews
  where resolved_at is not null and resolved_at < retention_cutoff;
  get diagnostics resolved_reviews_deleted = row_count;

  if to_regclass('cron.job_run_details') is not null then
    begin
      execute 'delete from cron.job_run_details where coalesce(end_time, start_time) < $1'
      using cron_log_cutoff;
      get diagnostics cron_runs_deleted = row_count;
    exception when insufficient_privilege then
      raise warning 'The scheduler run log could not be pruned (no privilege).';
    end;
  end if;

  return query values
    ('sync_runs', sync_runs_deleted),
    ('resolved_automation_alerts', resolved_alerts_deleted),
    ('resolved_schedule_change_reviews', resolved_reviews_deleted),
    ('cron_run_log', cron_runs_deleted);
end;
$$;

revoke all on function public.prune_operational_storage(timestamptz) from public, anon, authenticated;
grant execute on function public.prune_operational_storage(timestamptz) to service_role;

-- Clear the backlog once now; the weekly cleanup keeps it small from here on.
-- (The disk space is reused by Postgres at once; the reported database size
-- drops only after a manual VACUUM FULL of the table, which cannot run here.)
do $migration$
begin
  if to_regclass('cron.job_run_details') is not null then
    execute 'delete from cron.job_run_details where coalesce(end_time, start_time) < clock_timestamp() - interval ''7 days''';
  end if;
end
$migration$;
