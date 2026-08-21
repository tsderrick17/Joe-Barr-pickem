-- Record the once-daily external configuration check separately from the
-- five-minute watchdog while retaining the same bounded sync-run cleanup.
alter table public.sync_runs drop constraint if exists sync_runs_job_type_check;
alter table public.sync_runs add constraint sync_runs_job_type_check
  check (job_type in (
    'schedule', 'odds', 'scores', 'line_locks', 'season_bootstrap', 'watchdog',
    'configuration_drift'
  ));
