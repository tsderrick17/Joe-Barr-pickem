-- Runs every 15 minutes. The API checks the database first and only contacts
-- the score provider for unfinished games at least three hours past kickoff.
select cron.unschedule(jobid)
from cron.job
where jobname = 'refresh-final-nfl-scores-every-15-minutes';

select cron.schedule(
  'refresh-final-nfl-scores-every-15-minutes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/sync-scores',
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
