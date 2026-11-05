-- Score polling: the first check 175 minutes after kickoff, and the gate wakes the worker every five minutes.
--
-- The retry ladder (src/lib/score-retry-ladder.js) is now seven 5-minute gaps, two 10-minute gaps, three 20-minute gaps, then 60, 120 and 240.
-- The gate has to wake the worker on that same five-minute clock, and its "a final is due" rule has to use the same first-check minutes as
-- FIRST_SCORE_CHECK_DELAY_MINUTES (src/lib/score-window.js). Only those two things change here: score_work_is_due (170 -> 175 minutes) and the
-- pg_cron job (every ten minutes -> every five), plus the preflight row that names the job. Nothing about grading changes.

create or replace function public.score_work_is_due(evaluated_at timestamptz default clock_timestamp())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    -- A final is due: kicked off at least 175 minutes ago (FIRST_SCORE_CHECK_DELAY_MINUTES),
    -- not final yet, and past any provider retry timer.
    exists (
      select 1
      from public.games game
      where game.status in ('scheduled', 'live')
        and game.kickoff_at <= evaluated_at - interval '175 minutes'
        and not exists (
          select 1 from public.score_check_backoff backoff
          where backoff.game_id = game.id and backoff.next_check_at > evaluated_at
        )
    )
    -- A time the worker asked to be woken at.
    or exists (
      select 1 from public.automation_dispatch_state state
      where state.job_name = 'scores' and state.next_due_at <= evaluated_at
    )
    -- A week is waiting to open.
    or (
      not exists (select 1 from public.scoring_periods period where period.status = 'active')
      and exists (
        select 1 from public.scoring_periods period
        where period.status = 'upcoming' and period.starts_at <= evaluated_at
      )
    )
    -- Picks a run can settle now: a no-contest game, or a final game that has its official line.
    or exists (
      select 1
      from public.picks pick
      join public.games game on game.id = pick.game_id
      where pick.result = 'pending'
        and (
          game.status = 'no_contest'
          or (game.status = 'final' and exists (select 1 from public.game_lines line where line.game_id = game.id))
        )
    )
    or exists (
      select 1
      from public.survivor_picks pick
      join public.games game on game.id = pick.game_id
      where pick.result = 'pending' and game.status = 'no_contest'
    )
    -- The hourly safety run.
    or not exists (
      select 1 from public.automation_dispatch_state state
      where state.job_name = 'scores' and state.last_dispatched_at > evaluated_at - interval '55 minutes'
    );
$$;

revoke all on function public.score_work_is_due(timestamptz) from public, anon, authenticated;
grant execute on function public.score_work_is_due(timestamptz) to service_role;

-- Production exposes pg_cron helper functions; isolated rehearsal databases do not.
do $migration$
declare
  job record;
begin
  for job in select jobid from cron.job where jobname in (
    'refresh-final-nfl-scores-every-ten-minutes',
    'refresh-final-nfl-scores-every-five-minutes'
  ) loop
    if to_regprocedure('cron.unschedule(integer)') is not null then
      perform cron.unschedule(job.jobid::integer);
    elsif to_regprocedure('cron.unschedule(bigint)') is not null then
      perform cron.unschedule(job.jobid);
    end if;
  end loop;

  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('refresh-final-nfl-scores-every-five-minutes', '*/5 * * * *', 'select public.dispatch_score_sync_if_due();');
  elsif to_regprocedure('cron.schedule(text,text)') is not null then
    perform cron.schedule('*/5 * * * *', 'select public.dispatch_score_sync_if_due();');
  end if;
end
$migration$;

-- Preflight expects the five-minute score gate.
create or replace function public.automation_preflight()
returns table(check_id text, label text, passed boolean, detail text)
language sql security definer set search_path = public, cron, vault, pg_catalog as $$
  with required_jobs(job_name, job_label, expected_schedule, expected_marker, helper_name) as (
    values
      ('lock-official-lines-every-minute', 'Official line lock: gated every minute', '* * * * *', 'dispatch_line_lock_if_due', 'dispatch_line_lock_if_due'),
      ('refresh-nfl-schedule-and-spreads-prelock-early', 'Pre-lock spread refresh (daylight-safe)', '0 11 * 1,2,8,9,10,11,12 *', '/api/admin/import-games', null::text),
      ('refresh-nfl-schedule-and-spreads-prelock-standard', 'Pre-lock spread refresh (standard-safe)', '0 12 * 1,2,8,9,10,11,12 *', '/api/admin/import-games', null::text),
      ('refresh-final-nfl-scores-every-five-minutes', 'Final score worker: gated every five minutes', '*/5 * * * *', 'dispatch_score_sync_if_due', 'dispatch_score_sync_if_due'),
      ('refresh-bowl-pool-every-fifteen-minutes', 'Bowl Pool adaptive dispatch gate (15-minute ceiling)', '*/15 * * * *', 'dispatch_bowl_sync_if_due', 'dispatch_bowl_sync_if_due'),
      ('send-pickem-browser-reminders-every-five-minutes', 'Reminder delivery: gated every five minutes', '*/5 * * * *', 'dispatch_reminders_if_due', 'dispatch_reminders_if_due'),
      ('reconcile-pickem-email-schedule-every-thirty-minutes', 'Email schedule reconciliation every thirty minutes', '5,35 * * * *', '/api/cron/maintain-reminders', null::text),
      ('bootstrap-full-nfl-season-daily', 'Automatic preseason schedule bootstrap', '15 12 * 8,9 *', '/api/cron/bootstrap-season', null::text),
      ('pickem-operations-watchdog-every-fifteen-minutes', 'Operations watchdog every fifteen minutes', '*/15 * * * *', '/api/cron/watchdog', null::text)
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
