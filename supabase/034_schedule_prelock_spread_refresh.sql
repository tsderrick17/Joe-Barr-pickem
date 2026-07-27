-- Capture a preliminary DraftKings snapshot before the 8 AM Eastern line lock
-- throughout both daylight-saving and standard time. 11:00 UTC is 7 AM EDT
-- (6 AM EST); 12:00 UTC is 8 AM EDT (7 AM EST). Together they ensure a
-- fallback snapshot exists before lock without ever changing an official line.

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'refresh-nfl-schedule-and-spreads-daily',
  'refresh-nfl-schedule-and-spreads-prelock-early',
  'refresh-nfl-schedule-and-spreads-prelock-standard'
);

select cron.schedule(
  'refresh-nfl-schedule-and-spreads-prelock-early',
  '0 11 * 1,2,8,9,10,11,12 *',
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

select cron.schedule(
  'refresh-nfl-schedule-and-spreads-prelock-standard',
  '0 12 * 1,2,8,9,10,11,12 *',
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
