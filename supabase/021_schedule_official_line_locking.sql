-- Runs every minute. The API checks the database first and only contacts the
-- odds provider when one or more games are due for their official line lock.
select cron.unschedule(jobid)
from cron.job
where jobname = 'lock-official-lines-every-minute';

select cron.schedule(
  'lock-official-lines-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/lock-lines',
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
