-- Runs at 13:00 UTC (8 AM Eastern Standard Time / 9 AM Eastern Daylight Time)
-- during the NFL season months. The refresh upserts the schedule and records
-- preliminary DraftKings spread history; it never changes official locked lines.
select cron.unschedule(jobid)
from cron.job
where jobname = 'refresh-nfl-schedule-and-spreads-daily';

select cron.schedule(
  'refresh-nfl-schedule-and-spreads-daily',
  '0 13 * 1,2,8,9,10,11,12 *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/admin/import-games',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
