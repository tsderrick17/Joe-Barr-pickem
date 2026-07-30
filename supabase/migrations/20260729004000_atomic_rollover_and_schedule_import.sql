-- The season handoff and schedule import are scoreboard-critical operations.
-- Keep each operation in one transaction so a partial failure cannot leave a
-- saved game without a dated week, or a completed week without a successor.

create or replace function public.complete_scoring_period_atomically(
  target_scoring_period_id uuid,
  next_scoring_period_id uuid,
  rollover_at timestamptz
)
returns table(completed_period_id uuid, activated_period_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period public.scoring_periods%rowtype;
  next_period public.scoring_periods%rowtype;
begin
  if rollover_at is null or rollover_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The weekly handoff time is invalid.';
  end if;

  select * into target_period
  from public.scoring_periods
  where id = target_scoring_period_id
  for update;

  if not found or target_period.status <> 'active' then
    raise exception 'Only the active scoring period can be completed.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_period.season_id::text || ':weekly-handoff', 0));

  if exists (
    select 1 from public.games
    where scoring_period_id = target_period.id
      and status <> 'final'
  ) then
    raise exception 'Every game must be final before the weekly handoff.';
  end if;

  if not exists (select 1 from public.games where scoring_period_id = target_period.id) then
    raise exception 'A scoring period without games cannot be completed automatically.';
  end if;

  if exists (
    select 1 from public.games
    where scoring_period_id = target_period.id
      and finalized_at is null
  ) then
    raise exception 'Every final game requires an accepted final-score timestamp.';
  end if;

  if exists (
    select 1 from public.picks
    where scoring_period_id = target_period.id
      and result = 'pending'
  ) then
    raise exception 'Final ATS picks still need an official line or grade.';
  end if;

  if next_scoring_period_id is not null then
    select * into next_period
    from public.scoring_periods
    where id = next_scoring_period_id
    for update;

    if not found
      or next_period.season_id <> target_period.season_id
      or next_period.display_order <> target_period.display_order + 1
      or next_period.status <> 'upcoming' then
      raise exception 'The next scoring period is not eligible for activation.';
    end if;

    if not exists (select 1 from public.games where scoring_period_id = next_period.id) then
      raise exception 'The next scoring period cannot activate without an imported schedule.';
    end if;
  end if;

  update public.scoring_periods
  set status = 'complete'
  where id = target_period.id;

  if next_scoring_period_id is not null then
    update public.scoring_periods
    set status = 'active'
    where id = next_scoring_period_id;
  end if;

  insert into public.audit_logs (
    actor_player_id, action, entity_type, entity_id, details
  ) values (
    null, 'scoring_period_completed', 'scoring_period', target_period.id,
    jsonb_build_object(
      'rollover_at', rollover_at,
      'next_scoring_period_id', next_scoring_period_id
    )
  );

  return query select target_period.id, next_scoring_period_id;
end;
$$;

create or replace function public.import_schedule_atomically(
  target_season_id uuid,
  period_assignments jsonb,
  schedule_games jsonb,
  preliminary_spreads jsonb,
  imported_at timestamptz default clock_timestamp()
)
returns table(games_saved integer, preliminary_spreads_saved integer, new_weeks_assigned integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_game_count integer := 0;
  saved_spread_count integer := 0;
  assigned_week_count integer := 0;
begin
  if jsonb_typeof(period_assignments) is distinct from 'array'
    or jsonb_typeof(schedule_games) is distinct from 'array'
    or jsonb_typeof(preliminary_spreads) is distinct from 'array' then
    raise exception 'Schedule import payloads must be arrays.';
  end if;
  if imported_at is null or imported_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The schedule import time is invalid.';
  end if;
  if not exists (select 1 from public.seasons where id = target_season_id) then
    raise exception 'The import season does not exist.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_season_id::text || ':schedule-import', 0));

  if exists (
    select 1
    from jsonb_to_recordset(period_assignments) as assignment(
      scoring_period_id uuid, starts_at timestamptz, ends_at timestamptz
    )
    left join public.scoring_periods as period on period.id = assignment.scoring_period_id
    where assignment.scoring_period_id is null
      or assignment.starts_at is null
      or assignment.ends_at is null
      or assignment.starts_at >= assignment.ends_at
      or period.id is null
      or period.season_id <> target_season_id
      or (period.starts_at is not null and period.starts_at is distinct from assignment.starts_at)
      or (period.ends_at is not null and period.ends_at is distinct from assignment.ends_at)
  ) then
    raise exception 'A scoring period assignment is invalid or conflicts with saved history.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(schedule_games) as game(
      external_game_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz,
      is_international boolean
    )
    left join public.scoring_periods as period on period.id = game.scoring_period_id
    where game.external_game_id is null
      or game.scoring_period_id is null
      or game.away_team_id is null
      or game.home_team_id is null
      or game.kickoff_at is null
      or game.line_lock_at is null
      or game.away_team_id = game.home_team_id
      or period.id is null
      or period.season_id <> target_season_id
  ) then
    raise exception 'A scheduled game is invalid or belongs to another season.';
  end if;

  if exists (
    select external_game_id
    from jsonb_to_recordset(schedule_games) as game(external_game_id text)
    group by external_game_id
    having count(*) > 1
  ) then
    raise exception 'The schedule import repeats an external game identifier.';
  end if;

  if exists (
    select 1
    from public.games as saved_game
    join jsonb_to_recordset(schedule_games) as game(
      external_game_id text, scoring_period_id uuid
    ) on game.external_game_id = saved_game.external_game_id
    where saved_game.scoring_period_id <> game.scoring_period_id
  ) then
    raise exception 'A saved game cannot be reassigned to another scoring period.';
  end if;

  update public.scoring_periods as period
  set starts_at = assignment.starts_at,
      ends_at = assignment.ends_at
  from jsonb_to_recordset(period_assignments) as assignment(
    scoring_period_id uuid, starts_at timestamptz, ends_at timestamptz
  )
  where period.id = assignment.scoring_period_id
    and period.starts_at is null
    and period.ends_at is null;
  get diagnostics assigned_week_count = row_count;

  insert into public.games (
    external_game_id, scoring_period_id, away_team_id, home_team_id,
    kickoff_at, line_lock_at, is_international
  )
  select
    game.external_game_id, game.scoring_period_id, game.away_team_id,
    game.home_team_id, game.kickoff_at, game.line_lock_at,
    coalesce(game.is_international, false)
  from jsonb_to_recordset(schedule_games) as game(
    external_game_id text, scoring_period_id uuid, away_team_id uuid,
    home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz,
    is_international boolean
  )
  on conflict (external_game_id) do update
  set away_team_id = excluded.away_team_id,
      home_team_id = excluded.home_team_id,
      kickoff_at = excluded.kickoff_at,
      line_lock_at = excluded.line_lock_at,
      is_international = excluded.is_international;
  get diagnostics saved_game_count = row_count;

  insert into public.spread_history (
    game_id, favorite_team_id, spread, source, captured_at
  )
  select
    game.id, spread.favorite_team_id, spread.spread, spread.source, imported_at
  from jsonb_to_recordset(preliminary_spreads) as spread(
    external_game_id text, favorite_team_id uuid, spread numeric, source text
  )
  join public.games as game on game.external_game_id = spread.external_game_id
  where spread.favorite_team_id is not null
    and spread.spread >= 0
    and spread.source is not null;
  get diagnostics saved_spread_count = row_count;

  insert into public.audit_logs (
    actor_player_id, action, entity_type, entity_id, details
  ) values (
    null, 'schedule_imported', 'season', target_season_id,
    jsonb_build_object(
      'games_saved', saved_game_count,
      'preliminary_spreads_saved', saved_spread_count,
      'new_weeks_assigned', assigned_week_count,
      'imported_at', imported_at
    )
  );

  return query select saved_game_count, saved_spread_count, assigned_week_count;
end;
$$;

revoke all on function public.complete_scoring_period_atomically(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.import_schedule_atomically(uuid, jsonb, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_scoring_period_atomically(uuid, uuid, timestamptz)
  to service_role;
grant execute on function public.import_schedule_atomically(uuid, jsonb, jsonb, jsonb, timestamptz)
  to service_role;
