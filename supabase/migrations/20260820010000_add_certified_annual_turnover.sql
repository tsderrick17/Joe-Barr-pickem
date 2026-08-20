-- August 1 is both the season boundary and the safest time for a deeper
-- cleanup. Official competition records and delivery receipts remain
-- permanent. Cleanup is allowed only after the previous season is certified.

create table if not exists public.season_turnover_runs (
  target_year integer primary key check (target_year >= 2025),
  previous_season_id uuid references public.seasons(id) on delete set null,
  target_season_id uuid references public.seasons(id) on delete set null,
  status text not null check (status in ('blocked', 'completed')),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  blockers jsonb not null default '[]'::jsonb,
  preserved_counts jsonb not null default '{}'::jsonb,
  deleted_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.season_turnover_runs enable row level security;
revoke all on table public.season_turnover_runs from public, anon, authenticated;

-- Audit history remains append-only during normal operation. The annual
-- turnover may remove only superseded pre-kickoff save snapshots, and only
-- while its transaction-local guard is active. Its permanent receipt records
-- how many were removed.
create or replace function public.prevent_audit_log_changes()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('pickem.certified_turnover', true) = 'on'
    and old.action in ('ats_picks_saved', 'survivor_pick_saved', 'survivor_pick_cleared', 'slate_selections_saved') then
    return old;
  end if;
  raise exception 'Audit history is append-only and cannot be changed.';
end;
$$;

create or replace function public.perform_annual_season_turnover(
  evaluated_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  calculated_target_year integer := extract(year from evaluated_at at time zone 'America/New_York')::integer;
  target_month integer := extract(month from evaluated_at at time zone 'America/New_York')::integer;
  prior_year integer;
  prior_season public.seasons%rowtype;
  target_season public.seasons%rowtype;
  existing_run public.season_turnover_runs%rowtype;
  blockers jsonb := '[]'::jsonb;
  preserved jsonb := '{}'::jsonb;
  deleted jsonb := '{}'::jsonb;
  retention_deleted jsonb := '{}'::jsonb;
  cleanup_reference timestamptz := least(evaluated_at, clock_timestamp());
  superseded_pick_audits bigint := 0;
  redundant_spreads bigint := 0;
  stale_reminders bigint := 0;
  score_backoffs bigint := 0;
  expired_leases bigint := 0;
  provider_circuits bigint := 0;
  old_pin_attempts bigint := 0;
  old_pin_incidents bigint := 0;
  survivor_entries_created bigint := 0;
begin
  if target_month < 8 then
    calculated_target_year := calculated_target_year - 1;
  end if;
  prior_year := calculated_target_year - 1;

  perform pg_advisory_xact_lock(hashtext('certified-annual-season-turnover'));

  select * into existing_run
  from public.season_turnover_runs
  where target_year = calculated_target_year;

  if existing_run.status = 'completed' then
    return jsonb_build_object(
      'status', existing_run.status,
      'targetYear', calculated_target_year,
      'completedAt', existing_run.completed_at,
      'blockers', existing_run.blockers,
      'preserved', existing_run.preserved_counts,
      'deleted', existing_run.deleted_counts,
      'retry', true
    );
  end if;

  select * into target_season from public.seasons where year = calculated_target_year;
  select * into prior_season from public.seasons where year = prior_year;

  if target_season.id is null then
    blockers := blockers || jsonb_build_array('The new season has not been created yet.');
  end if;

  if prior_season.id is not null then
    if prior_season.state <> 'complete' then
      blockers := blockers || jsonb_build_array('The previous season is not marked complete.');
    end if;
    if exists (
      select 1 from public.scoring_periods
      where season_id = prior_season.id and status <> 'complete'
    ) then
      blockers := blockers || jsonb_build_array('One or more previous-season scoring periods are incomplete.');
    end if;
    if exists (
      select 1
      from public.games game
      join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = prior_season.id
        and game.status not in ('final', 'cancelled', 'no_contest')
    ) then
      blockers := blockers || jsonb_build_array('One or more previous-season games are not settled.');
    end if;
    if exists (
      select 1
      from public.picks pick
      join public.scoring_periods period on period.id = pick.scoring_period_id
      where period.season_id = prior_season.id and pick.result = 'pending'
    ) then
      blockers := blockers || jsonb_build_array('One or more previous-season Pick''em selections are ungraded.');
    end if;
    if exists (
      select 1
      from public.survivor_picks pick
      join public.scoring_periods period on period.id = pick.scoring_period_id
      where period.season_id = prior_season.id and pick.result = 'pending'
    ) then
      blockers := blockers || jsonb_build_array('One or more previous-season Survivor selections are ungraded.');
    end if;
    if exists (
      select 1
      from public.schedule_change_reviews review
      join public.games game on game.id = review.game_id
      join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = prior_season.id and review.resolved_at is null
    ) then
      blockers := blockers || jsonb_build_array('A previous-season schedule change still needs Commissioner review.');
    end if;
    if exists (
      select 1
      from public.picks pick
      join public.scoring_periods period on period.id = pick.scoring_period_id
      where period.season_id = prior_season.id and pick.result <> 'void'
    ) and not exists (
      select 1 from public.pool_championships
      where season_year = prior_year and pool = 'pickem'
    ) then
      blockers := blockers || jsonb_build_array('The previous Pick''em championship has not been recorded.');
    end if;
    if exists (
      select 1 from public.survivor_entries where season_id = prior_season.id
    ) and not exists (
      select 1 from public.pool_championships
      where season_year = prior_year and pool = 'survivor'
    ) then
      blockers := blockers || jsonb_build_array('The previous Survivor championship has not been recorded.');
    end if;
  end if;

  if jsonb_array_length(blockers) > 0 then
    insert into public.season_turnover_runs (
      target_year, previous_season_id, target_season_id, status, started_at,
      completed_at, blockers, preserved_counts, deleted_counts, updated_at
    ) values (
      calculated_target_year, prior_season.id, target_season.id, 'blocked',
      clock_timestamp(), null, blockers, '{}'::jsonb, '{}'::jsonb, clock_timestamp()
    )
    on conflict (target_year) do update set
      previous_season_id = excluded.previous_season_id,
      target_season_id = excluded.target_season_id,
      status = 'blocked',
      completed_at = null,
      blockers = excluded.blockers,
      updated_at = clock_timestamp();

    return jsonb_build_object(
      'status', 'blocked',
      'targetYear', calculated_target_year,
      'blockers', blockers,
      'preserved', '{}'::jsonb,
      'deleted', '{}'::jsonb,
      'retry', existing_run.target_year is not null
    );
  end if;

  if prior_season.id is not null then
    select jsonb_build_object(
      'games', (select count(*) from public.games game join public.scoring_periods period on period.id = game.scoring_period_id where period.season_id = prior_season.id),
      'officialLines', (select count(*) from public.game_lines line join public.games game on game.id = line.game_id join public.scoring_periods period on period.id = game.scoring_period_id where period.season_id = prior_season.id),
      'officialPickemPicks', (select count(*) from public.picks pick join public.scoring_periods period on period.id = pick.scoring_period_id where period.season_id = prior_season.id),
      'officialSurvivorPicks', (select count(*) from public.survivor_picks pick join public.scoring_periods period on period.id = pick.scoring_period_id where period.season_id = prior_season.id),
      'championships', (select count(*) from public.pool_championships where season_year = prior_year),
      'emailReceipts', (select count(*) from public.email_reminder_deliveries where attempted_at < cleanup_reference),
      'pushReceipts', (select count(*) from public.push_reminder_deliveries where attempted_at < cleanup_reference)
    ) into preserved;

    perform set_config('pickem.certified_turnover', 'on', true);
    with ranked as (
      select audit.id,
        row_number() over (
          partition by audit.actor_player_id, audit.entity_id,
            case
              when audit.action in ('survivor_pick_saved', 'survivor_pick_cleared') then 'survivor_pick_revision'
              when audit.action = 'slate_selections_saved' then 'legacy_slate_revision'
              else audit.action
            end
          order by audit.created_at desc, audit.id desc
        ) as revision_number
      from public.audit_logs audit
      join public.scoring_periods period on period.id = audit.entity_id
      where period.season_id = prior_season.id
        and audit.action in ('ats_picks_saved', 'survivor_pick_saved', 'survivor_pick_cleared', 'slate_selections_saved')
    ), removed as (
      delete from public.audit_logs audit
      using ranked
      where audit.id = ranked.id and ranked.revision_number > 1
      returning 1
    ) select count(*) into superseded_pick_audits from removed;
    perform set_config('pickem.certified_turnover', 'off', true);

    with ranked as (
      select history.id,
        row_number() over (
          partition by history.game_id
          order by history.captured_at desc, history.id desc
        ) as snapshot_number
      from public.spread_history history
      join public.games game on game.id = history.game_id
      join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = prior_season.id
    ), removed as (
      delete from public.spread_history history
      using ranked
      where history.id = ranked.id and ranked.snapshot_number > 1
      returning 1
    ) select count(*) into redundant_spreads from removed;

    with removed as (
      delete from public.score_check_backoff backoff
      using public.games game, public.scoring_periods period
      where backoff.game_id = game.id
        and game.scoring_period_id = period.id
        and period.season_id = prior_season.id
      returning 1
    ) select count(*) into score_backoffs from removed;
  end if;

  update public.push_reminders
  set status = 'cancelled', cancelled_at = cleanup_reference,
      updated_at = cleanup_reference, processing_started_at = null
  where status in ('scheduled', 'sending') and scheduled_for < cleanup_reference;
  get diagnostics stale_reminders = row_count;

  delete from public.automation_execution_leases where locked_until <= cleanup_reference;
  get diagnostics expired_leases = row_count;

  delete from public.provider_failure_circuits;
  get diagnostics provider_circuits = row_count;

  delete from public.pin_login_attempts where attempted_at < cleanup_reference - interval '24 hours';
  get diagnostics old_pin_attempts = row_count;

  delete from public.pin_login_incidents where alert_until < cleanup_reference - interval '180 days';
  get diagnostics old_pin_incidents = row_count;

  select coalesce(jsonb_object_agg(cleanup.record_type, cleanup.deleted_count), '{}'::jsonb)
  into retention_deleted
  from public.prune_operational_storage(cleanup_reference) cleanup;

  insert into public.survivor_entries (player_id, season_id)
  select player.id, target_season.id
  from public.players player
  where player.active
  on conflict (player_id, season_id) do nothing;
  get diagnostics survivor_entries_created = row_count;

  deleted := retention_deleted || jsonb_build_object(
    'supersededPickSaveSnapshots', superseded_pick_audits,
    'redundantPreliminarySpreads', redundant_spreads,
    'staleOldSeasonReminders', stale_reminders,
    'oldScoreBackoffs', score_backoffs,
    'expiredAutomationLeases', expired_leases,
    'providerFailureCircuits', provider_circuits,
    'oldPinAttempts', old_pin_attempts,
    'oldPinIncidents', old_pin_incidents
  );

  insert into public.season_turnover_runs (
    target_year, previous_season_id, target_season_id, status, started_at,
    completed_at, blockers, preserved_counts, deleted_counts, updated_at
  ) values (
    calculated_target_year, prior_season.id, target_season.id, 'completed',
    coalesce(existing_run.started_at, clock_timestamp()), clock_timestamp(),
    '[]'::jsonb, preserved, deleted, clock_timestamp()
  )
  on conflict (target_year) do update set
    previous_season_id = excluded.previous_season_id,
    target_season_id = excluded.target_season_id,
    status = 'completed',
    completed_at = excluded.completed_at,
    blockers = '[]'::jsonb,
    preserved_counts = excluded.preserved_counts,
    deleted_counts = excluded.deleted_counts,
    updated_at = clock_timestamp();

  insert into public.audit_logs(action, entity_type, entity_id, details)
  values (
    'season_turnover_completed', 'season', target_season.id,
    jsonb_build_object(
      'target_year', calculated_target_year,
      'previous_season_id', prior_season.id,
      'preserved', preserved,
      'deleted', deleted,
      'survivor_entries_created', survivor_entries_created
    )
  );

  return jsonb_build_object(
    'status', 'completed',
    'targetYear', calculated_target_year,
    'completedAt', clock_timestamp(),
    'blockers', '[]'::jsonb,
    'preserved', preserved,
    'deleted', deleted,
    'survivorEntriesCreated', survivor_entries_created,
    'retry', false
  );
end;
$$;

revoke all on function public.perform_annual_season_turnover(timestamptz)
  from public, anon, authenticated;
grant execute on function public.perform_annual_season_turnover(timestamptz)
  to service_role;
