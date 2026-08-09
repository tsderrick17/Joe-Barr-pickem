-- A provider refresh is allowed to add games and correct an unlocked kickoff,
-- but it must never silently rewrite a locked, settled, re-paired, or
-- week-crossing game. Provider omissions are deliberately ignored: an outage
-- or partial feed must not delete league history.
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
  released_line_count integer := 0;
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
      or assignment.starts_at is null or assignment.ends_at is null
      or assignment.starts_at >= assignment.ends_at
      or period.id is null or period.season_id <> target_season_id
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
    where game.external_game_id is null or game.scoring_period_id is null
      or game.away_team_id is null or game.home_team_id is null
      or game.kickoff_at is null or game.line_lock_at is null
      or game.line_lock_at >= game.kickoff_at
      or game.away_team_id = game.home_team_id
      or period.id is null or period.season_id <> target_season_id
  ) then
    raise exception 'A scheduled game is invalid or belongs to another season.';
  end if;

  if exists (
    select external_game_id
    from jsonb_to_recordset(schedule_games) as game(external_game_id text)
    group by external_game_id having count(*) > 1
  ) then
    raise exception 'The schedule import repeats an external game identifier.';
  end if;

  -- These are review conditions, not data-cleanup opportunities. In
  -- particular, never move a game to another scoring period automatically.
  if exists (
    select 1
    from public.games as saved
    join jsonb_to_recordset(schedule_games) as incoming(
      external_game_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz,
      is_international boolean
    ) on incoming.external_game_id = saved.external_game_id
    where saved.scoring_period_id <> incoming.scoring_period_id
      or saved.away_team_id <> incoming.away_team_id
      or saved.home_team_id <> incoming.home_team_id
      or (
        (saved.kickoff_at is distinct from incoming.kickoff_at
          or saved.line_lock_at is distinct from incoming.line_lock_at)
        and (saved.status <> 'scheduled' or saved.line_lock_at <= imported_at)
      )
  ) then
    raise exception 'Schedule review required: a saved game is locked, settled, re-paired, or assigned to a different scoring period.';
  end if;

  update public.scoring_periods as period
  set starts_at = assignment.starts_at, ends_at = assignment.ends_at
  from jsonb_to_recordset(period_assignments) as assignment(
    scoring_period_id uuid, starts_at timestamptz, ends_at timestamptz
  )
  where period.id = assignment.scoring_period_id
    and period.starts_at is null and period.ends_at is null;
  get diagnostics assigned_week_count = row_count;

  -- Correct a genuinely moved, not-yet-locked game and reopen its line. Picks
  -- remain attached to the same game; only the old official line is released.
  delete from public.game_lines as line
  using public.games as saved,
    jsonb_to_recordset(schedule_games) as incoming(
      external_game_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz,
      is_international boolean
    )
  where line.game_id = saved.id
    and saved.external_game_id = incoming.external_game_id
    and (saved.kickoff_at is distinct from incoming.kickoff_at
      or saved.line_lock_at is distinct from incoming.line_lock_at);
  get diagnostics released_line_count = row_count;

  with changed as (
    update public.games as saved
    set kickoff_at = incoming.kickoff_at,
        line_lock_at = incoming.line_lock_at,
        is_international = coalesce(incoming.is_international, false)
    from jsonb_to_recordset(schedule_games) as incoming(
      external_game_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz,
      is_international boolean
    )
    where saved.external_game_id = incoming.external_game_id
      and (saved.kickoff_at is distinct from incoming.kickoff_at
        or saved.line_lock_at is distinct from incoming.line_lock_at)
    returning saved.id, saved.external_game_id
  )
  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  select null, 'game_rescheduled', 'game', changed.id,
    jsonb_build_object('source', 'schedule_import', 'external_game_id', changed.external_game_id,
      'official_line_recheck_required', true,
      'imported_at', imported_at)
  from changed;

  insert into public.games(
    external_game_id, scoring_period_id, away_team_id, home_team_id,
    kickoff_at, line_lock_at, is_international
  )
  select incoming.external_game_id, incoming.scoring_period_id,
    incoming.away_team_id, incoming.home_team_id, incoming.kickoff_at,
    incoming.line_lock_at, coalesce(incoming.is_international, false)
  from jsonb_to_recordset(schedule_games) as incoming(
    external_game_id text, scoring_period_id uuid, away_team_id uuid,
    home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz,
    is_international boolean
  )
  left join public.games as saved on saved.external_game_id = incoming.external_game_id
  where saved.id is null;
  get diagnostics saved_game_count = row_count;

  insert into public.spread_history(game_id, favorite_team_id, spread, source, captured_at)
  select game.id, spread.favorite_team_id, spread.spread, spread.source, imported_at
  from jsonb_to_recordset(preliminary_spreads) as spread(
    external_game_id text, favorite_team_id uuid, spread numeric, source text
  )
  join public.games as game on game.external_game_id = spread.external_game_id
  where spread.favorite_team_id is not null and spread.spread >= 0 and spread.source is not null;
  get diagnostics saved_spread_count = row_count;

  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  values (null, 'schedule_imported', 'season', target_season_id,
    jsonb_build_object('new_games_saved', saved_game_count,
      'preliminary_spreads_saved', saved_spread_count,
      'obsolete_official_lines_released', released_line_count,
      'new_weeks_assigned', assigned_week_count, 'imported_at', imported_at,
      'provider_omissions_preserved', true));

  return query select saved_game_count, saved_spread_count, assigned_week_count;
end;
$$;

revoke all on function public.import_schedule_atomically(uuid, jsonb, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.import_schedule_atomically(uuid, jsonb, jsonb, jsonb, timestamptz)
  to service_role;
