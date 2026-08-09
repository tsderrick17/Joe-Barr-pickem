-- A complete preseason schedule and the live odds feed use different event
-- identifiers. Preserve both so the daily feed can attach lines/scores to the
-- preseason game instead of creating a duplicate.
alter table public.games add column if not exists schedule_source text;
alter table public.games add column if not exists schedule_source_event_id text;
alter table public.games add column if not exists odds_event_id text;

update public.games
set schedule_source = coalesce(schedule_source, 'the_odds_api'),
    schedule_source_event_id = coalesce(schedule_source_event_id, external_game_id),
    odds_event_id = coalesce(odds_event_id, external_game_id);

create unique index if not exists games_schedule_source_event_id_key
  on public.games(schedule_source, schedule_source_event_id)
  where schedule_source is not null and schedule_source_event_id is not null;
create unique index if not exists games_odds_event_id_key
  on public.games(odds_event_id) where odds_event_id is not null;

create or replace function public.import_full_schedule_atomically(
  target_season_id uuid,
  period_assignments jsonb,
  schedule_games jsonb,
  imported_at timestamptz default clock_timestamp()
)
returns table(games_saved integer, games_matched integer, weeks_assigned integer)
language plpgsql security definer set search_path = public
as $$
declare
  saved_count integer := 0;
  matched_count integer := 0;
  assigned_count integer := 0;
begin
  if jsonb_typeof(period_assignments) is distinct from 'array'
    or jsonb_typeof(schedule_games) is distinct from 'array' then
    raise exception 'Full-schedule import payloads must be arrays.';
  end if;
  if imported_at is null or imported_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The full-schedule import time is invalid.';
  end if;
  if not exists (select 1 from public.seasons where id = target_season_id and state = 'preseason') then
    raise exception 'The target season does not exist or is no longer in preseason.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_season_id::text || ':schedule-import', 0));

  if (select count(*) from jsonb_to_recordset(period_assignments) as a(scoring_period_id uuid)) <> 18
    or (select count(*) from jsonb_to_recordset(schedule_games) as g(external_game_id text)) <> 272 then
    raise exception 'A full preseason import requires 18 weeks and 272 games.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(period_assignments) as a(scoring_period_id uuid, starts_at timestamptz, ends_at timestamptz)
    left join public.scoring_periods p on p.id = a.scoring_period_id
    where a.scoring_period_id is null or a.starts_at is null or a.ends_at is null or a.starts_at >= a.ends_at
      or p.id is null or p.season_id <> target_season_id or p.period_type <> 'regular'
      or (p.starts_at is not null and p.starts_at is distinct from a.starts_at)
      or (p.ends_at is not null and p.ends_at is distinct from a.ends_at)
  ) then raise exception 'A full-schedule week conflicts with the saved season template.'; end if;
  if exists (
    select 1 from jsonb_to_recordset(schedule_games) as g(
      external_game_id text, schedule_source text, schedule_source_event_id text,
      scoring_period_id uuid, away_team_id uuid, home_team_id uuid,
      kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean, gameweek_key date)
    left join public.scoring_periods p on p.id = g.scoring_period_id
    where g.external_game_id is null or g.schedule_source is null or g.schedule_source_event_id is null
      or g.scoring_period_id is null or g.away_team_id is null or g.home_team_id is null
      or g.kickoff_at is null or g.line_lock_at is null or g.gameweek_key is null
      or g.line_lock_at >= g.kickoff_at or g.away_team_id = g.home_team_id
      or p.id is null or p.season_id <> target_season_id
      or public.nfl_gameweek_key(g.kickoff_at) <> g.gameweek_key
  ) then raise exception 'The provider returned an invalid full-schedule game.'; end if;
  if exists (
    select schedule_source, schedule_source_event_id
    from jsonb_to_recordset(schedule_games) as g(schedule_source text, schedule_source_event_id text)
    group by schedule_source, schedule_source_event_id having count(*) > 1
  ) then raise exception 'The provider repeated a schedule game identifier.'; end if;

  -- One provider row may match either its prior source identity or one existing
  -- odds-only row for the exact teams and pinned period, never more than one.
  if exists (
    select 1
    from jsonb_to_recordset(schedule_games) as g(schedule_source text, schedule_source_event_id text,
      scoring_period_id uuid, away_team_id uuid, home_team_id uuid)
    join lateral (
      select count(*) as matches from public.games saved
      where (saved.schedule_source = g.schedule_source and saved.schedule_source_event_id = g.schedule_source_event_id)
         or (saved.scoring_period_id = g.scoring_period_id and saved.away_team_id = g.away_team_id and saved.home_team_id = g.home_team_id)
    ) found on true where found.matches > 1
  ) then raise exception 'Schedule review required: a provider game matches more than one saved game.'; end if;

  if exists (
    select 1 from jsonb_to_recordset(schedule_games) as g(schedule_source text, schedule_source_event_id text,
      scoring_period_id uuid, away_team_id uuid, home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz)
    join public.games saved on
      (saved.schedule_source = g.schedule_source and saved.schedule_source_event_id = g.schedule_source_event_id)
      or (saved.scoring_period_id = g.scoring_period_id and saved.away_team_id = g.away_team_id and saved.home_team_id = g.home_team_id)
    where saved.scoring_period_id <> g.scoring_period_id or saved.away_team_id <> g.away_team_id
      or saved.home_team_id <> g.home_team_id
      or ((saved.kickoff_at is distinct from g.kickoff_at or saved.line_lock_at is distinct from g.line_lock_at)
          and (saved.status <> 'scheduled' or saved.line_lock_at <= imported_at))
  ) then raise exception 'Schedule review required: a saved game is locked, settled, re-paired, or pinned to another week.'; end if;

  update public.scoring_periods p set starts_at = a.starts_at, ends_at = a.ends_at
  from jsonb_to_recordset(period_assignments) as a(scoring_period_id uuid, starts_at timestamptz, ends_at timestamptz)
  where p.id = a.scoring_period_id and p.starts_at is null and p.ends_at is null;
  get diagnostics assigned_count = row_count;

  delete from public.game_lines line using public.games saved,
    jsonb_to_recordset(schedule_games) as g(schedule_source text, schedule_source_event_id text,
      scoring_period_id uuid, away_team_id uuid, home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz)
  where line.game_id = saved.id
    and ((saved.schedule_source = g.schedule_source and saved.schedule_source_event_id = g.schedule_source_event_id)
      or (saved.scoring_period_id = g.scoring_period_id and saved.away_team_id = g.away_team_id and saved.home_team_id = g.home_team_id))
    and (saved.kickoff_at is distinct from g.kickoff_at or saved.line_lock_at is distinct from g.line_lock_at);

  with changed as (
    update public.games saved set
      schedule_source = g.schedule_source, schedule_source_event_id = g.schedule_source_event_id,
      kickoff_at = g.kickoff_at, line_lock_at = g.line_lock_at,
      is_international = coalesce(g.is_international, false)
    from jsonb_to_recordset(schedule_games) as g(schedule_source text, schedule_source_event_id text,
      scoring_period_id uuid, away_team_id uuid, home_team_id uuid,
      kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean)
    where (saved.schedule_source = g.schedule_source and saved.schedule_source_event_id = g.schedule_source_event_id)
       or (saved.scoring_period_id = g.scoring_period_id and saved.away_team_id = g.away_team_id and saved.home_team_id = g.home_team_id)
    returning saved.id
  ) select count(*) into matched_count from changed;

  insert into public.games(external_game_id, schedule_source, schedule_source_event_id,
    scoring_period_id, away_team_id, home_team_id, kickoff_at, line_lock_at, is_international, gameweek_key)
  select g.external_game_id, g.schedule_source, g.schedule_source_event_id, g.scoring_period_id,
    g.away_team_id, g.home_team_id, g.kickoff_at, g.line_lock_at, coalesce(g.is_international, false), g.gameweek_key
  from jsonb_to_recordset(schedule_games) as g(external_game_id text, schedule_source text, schedule_source_event_id text,
    scoring_period_id uuid, away_team_id uuid, home_team_id uuid, kickoff_at timestamptz,
    line_lock_at timestamptz, is_international boolean, gameweek_key date)
  where not exists (select 1 from public.games saved
    where (saved.schedule_source = g.schedule_source and saved.schedule_source_event_id = g.schedule_source_event_id)
       or (saved.scoring_period_id = g.scoring_period_id and saved.away_team_id = g.away_team_id and saved.home_team_id = g.home_team_id));
  get diagnostics saved_count = row_count;

  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  values(null, 'full_schedule_imported', 'season', target_season_id,
    jsonb_build_object('provider', 'nflverse', 'new_games_saved', saved_count,
      'existing_games_matched', matched_count, 'weeks_assigned', assigned_count,
      'expected_games', 272, 'imported_at', imported_at));
  return query select saved_count, matched_count, assigned_count;
end;
$$;

revoke all on function public.import_full_schedule_atomically(uuid, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.import_full_schedule_atomically(uuid, jsonb, jsonb, timestamptz) to service_role;

-- Extend the live reconciliation RPC so an Odds API event attaches to a
-- preseason row by exact teams + pinned period when it has no odds identity.
create or replace function public.import_schedule_atomically(
  target_season_id uuid, period_assignments jsonb, schedule_games jsonb,
  preliminary_spreads jsonb, imported_at timestamptz default clock_timestamp()
)
returns table(games_saved integer, preliminary_spreads_saved integer, new_weeks_assigned integer)
language plpgsql security definer set search_path = public
as $$
declare
  saved_game_count integer := 0; saved_spread_count integer := 0;
  assigned_week_count integer := 0; released_line_count integer := 0;
begin
  if jsonb_typeof(period_assignments) is distinct from 'array' or jsonb_typeof(schedule_games) is distinct from 'array'
    or jsonb_typeof(preliminary_spreads) is distinct from 'array' then raise exception 'Schedule import payloads must be arrays.'; end if;
  if imported_at is null or imported_at > clock_timestamp() + interval '5 minutes' then raise exception 'The schedule import time is invalid.'; end if;
  if not exists(select 1 from public.seasons where id = target_season_id) then raise exception 'The import season does not exist.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_season_id::text || ':schedule-import', 0));
  if exists(select 1 from jsonb_to_recordset(period_assignments) a(scoring_period_id uuid, starts_at timestamptz, ends_at timestamptz)
    left join public.scoring_periods p on p.id=a.scoring_period_id where a.scoring_period_id is null or a.starts_at is null or a.ends_at is null
    or a.starts_at>=a.ends_at or p.id is null or p.season_id<>target_season_id
    or (p.starts_at is not null and p.starts_at is distinct from a.starts_at) or (p.ends_at is not null and p.ends_at is distinct from a.ends_at))
    then raise exception 'A scoring period assignment is invalid or conflicts with saved history.'; end if;
  if exists(select 1 from jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid, away_team_id uuid,
    home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean)
    left join public.scoring_periods p on p.id=g.scoring_period_id where g.external_game_id is null or g.scoring_period_id is null
    or g.away_team_id is null or g.home_team_id is null or g.kickoff_at is null or g.line_lock_at is null
    or g.line_lock_at>=g.kickoff_at or g.away_team_id=g.home_team_id or p.id is null or p.season_id<>target_season_id)
    then raise exception 'A scheduled game is invalid or belongs to another season.'; end if;
  if exists(select external_game_id from jsonb_to_recordset(schedule_games) g(external_game_id text)
    group by external_game_id having count(*)>1) then raise exception 'The schedule import repeats an external game identifier.'; end if;
  if exists(select 1 from jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid, away_team_id uuid, home_team_id uuid)
    join lateral (select count(*) matches from public.games saved where saved.odds_event_id=g.external_game_id
      or saved.external_game_id=g.external_game_id
      or (saved.odds_event_id is null and saved.scoring_period_id=g.scoring_period_id and saved.away_team_id=g.away_team_id and saved.home_team_id=g.home_team_id)) found on true
    where found.matches>1) then raise exception 'Schedule review required: an odds event matches more than one saved game.'; end if;
  if exists(select 1 from public.games saved join jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid,
    away_team_id uuid, home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean)
    on saved.odds_event_id=g.external_game_id or saved.external_game_id=g.external_game_id
      or (saved.odds_event_id is null and saved.scoring_period_id=g.scoring_period_id and saved.away_team_id=g.away_team_id and saved.home_team_id=g.home_team_id)
    where saved.scoring_period_id<>g.scoring_period_id or saved.away_team_id<>g.away_team_id or saved.home_team_id<>g.home_team_id
      or ((saved.kickoff_at is distinct from g.kickoff_at or saved.line_lock_at is distinct from g.line_lock_at)
        and (saved.status<>'scheduled' or saved.line_lock_at<=imported_at)))
    then raise exception 'Schedule review required: a saved game is locked, settled, re-paired, or assigned to a different scoring period.'; end if;

  update public.scoring_periods p set starts_at=a.starts_at, ends_at=a.ends_at
  from jsonb_to_recordset(period_assignments) a(scoring_period_id uuid, starts_at timestamptz, ends_at timestamptz)
  where p.id=a.scoring_period_id and p.starts_at is null and p.ends_at is null;
  get diagnostics assigned_week_count=row_count;
  update public.games saved set odds_event_id=g.external_game_id
  from jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid, away_team_id uuid, home_team_id uuid)
  where saved.odds_event_id is null and saved.scoring_period_id=g.scoring_period_id
    and saved.away_team_id=g.away_team_id and saved.home_team_id=g.home_team_id;

  delete from public.game_lines line using public.games saved,
    jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean)
  where line.game_id=saved.id and coalesce(saved.odds_event_id,saved.external_game_id)=g.external_game_id
    and (saved.kickoff_at is distinct from g.kickoff_at or saved.line_lock_at is distinct from g.line_lock_at);
  get diagnostics released_line_count=row_count;
  with changed as (
    update public.games saved set kickoff_at=g.kickoff_at, line_lock_at=g.line_lock_at, is_international=coalesce(g.is_international,false)
    from jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean)
    where coalesce(saved.odds_event_id,saved.external_game_id)=g.external_game_id
      and (saved.kickoff_at is distinct from g.kickoff_at or saved.line_lock_at is distinct from g.line_lock_at)
    returning saved.id,saved.external_game_id)
  insert into public.audit_logs(actor_player_id,action,entity_type,entity_id,details)
  select null,'game_rescheduled','game',changed.id,jsonb_build_object('source','schedule_import','external_game_id',changed.external_game_id,
    'official_line_recheck_required',true,'imported_at',imported_at) from changed;
  insert into public.games(external_game_id,odds_event_id,schedule_source,schedule_source_event_id,scoring_period_id,away_team_id,home_team_id,kickoff_at,line_lock_at,is_international)
  select g.external_game_id,g.external_game_id,'the_odds_api',g.external_game_id,g.scoring_period_id,g.away_team_id,g.home_team_id,g.kickoff_at,g.line_lock_at,coalesce(g.is_international,false)
  from jsonb_to_recordset(schedule_games) g(external_game_id text,scoring_period_id uuid,away_team_id uuid,home_team_id uuid,kickoff_at timestamptz,line_lock_at timestamptz,is_international boolean)
  where not exists(select 1 from public.games saved where coalesce(saved.odds_event_id,saved.external_game_id)=g.external_game_id);
  get diagnostics saved_game_count=row_count;
  insert into public.spread_history(game_id,favorite_team_id,spread,source,captured_at)
  select game.id,spread.favorite_team_id,spread.spread,spread.source,imported_at
  from jsonb_to_recordset(preliminary_spreads) spread(external_game_id text,favorite_team_id uuid,spread numeric,source text)
  join public.games game on coalesce(game.odds_event_id,game.external_game_id)=spread.external_game_id
  where spread.favorite_team_id is not null and spread.spread>=0 and spread.source is not null;
  get diagnostics saved_spread_count=row_count;
  insert into public.audit_logs(actor_player_id,action,entity_type,entity_id,details)
  values(null,'schedule_imported','season',target_season_id,jsonb_build_object('new_games_saved',saved_game_count,
    'preliminary_spreads_saved',saved_spread_count,'obsolete_official_lines_released',released_line_count,
    'new_weeks_assigned',assigned_week_count,'imported_at',imported_at,'provider_omissions_preserved',true));
  return query select saved_game_count,saved_spread_count,assigned_week_count;
end;
$$;

revoke all on function public.import_schedule_atomically(uuid,jsonb,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.import_schedule_atomically(uuid,jsonb,jsonb,jsonb,timestamptz) to service_role;
