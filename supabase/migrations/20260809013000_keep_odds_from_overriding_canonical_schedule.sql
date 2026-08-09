-- The odds provider supplies market data, not the season's authoritative
-- schedule. Once nflverse has created the full schedule, odds events may be
-- linked to those games but can never change their date, lock, teams, or
-- scoring period.
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
  if exists(select 1 from jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid, away_team_id uuid, home_team_id uuid, kickoff_at timestamptz)
    join lateral (select count(*) matches from public.games saved where saved.odds_event_id=g.external_game_id
      or saved.external_game_id=g.external_game_id
      or (saved.odds_event_id is null and saved.scoring_period_id=g.scoring_period_id and saved.away_team_id=g.away_team_id and saved.home_team_id=g.home_team_id)
      or (saved.odds_event_id is null and saved.schedule_source='nflverse' and saved.away_team_id=g.away_team_id and saved.home_team_id=g.home_team_id
        and abs(extract(epoch from (saved.kickoff_at-g.kickoff_at))) <= 864000)) found on true
    where found.matches>1) then raise exception 'Schedule review required: an odds event matches more than one saved game.'; end if;
  if exists(select 1 from public.games saved join jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid,
    away_team_id uuid, home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean)
    on saved.odds_event_id=g.external_game_id or saved.external_game_id=g.external_game_id
      or (saved.odds_event_id is null and saved.scoring_period_id=g.scoring_period_id and saved.away_team_id=g.away_team_id and saved.home_team_id=g.home_team_id)
    where saved.schedule_source is distinct from 'nflverse' and (saved.scoring_period_id<>g.scoring_period_id or saved.away_team_id<>g.away_team_id or saved.home_team_id<>g.home_team_id
      or ((saved.kickoff_at is distinct from g.kickoff_at or saved.line_lock_at is distinct from g.line_lock_at)
        and (saved.status<>'scheduled' or saved.line_lock_at<=imported_at)))
    then raise exception 'Schedule review required: a saved game is locked, settled, re-paired, or assigned to a different scoring period.'; end if;

  update public.scoring_periods p set starts_at=a.starts_at, ends_at=a.ends_at
  from jsonb_to_recordset(period_assignments) a(scoring_period_id uuid, starts_at timestamptz, ends_at timestamptz)
  where p.id=a.scoring_period_id and p.starts_at is null and p.ends_at is null;
  get diagnostics assigned_week_count=row_count;
  update public.games saved set odds_event_id=g.external_game_id
  from jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid, away_team_id uuid, home_team_id uuid, kickoff_at timestamptz)
  where saved.odds_event_id is null and saved.away_team_id=g.away_team_id and saved.home_team_id=g.home_team_id
    and (saved.scoring_period_id=g.scoring_period_id
      or (saved.schedule_source='nflverse' and abs(extract(epoch from (saved.kickoff_at-g.kickoff_at))) <= 864000));

  delete from public.game_lines line using public.games saved,
    jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean)
  where line.game_id=saved.id and saved.schedule_source is distinct from 'nflverse'
    and coalesce(saved.odds_event_id,saved.external_game_id)=g.external_game_id
    and (saved.kickoff_at is distinct from g.kickoff_at or saved.line_lock_at is distinct from g.line_lock_at);
  get diagnostics released_line_count=row_count;
  with changed as (
    update public.games saved set kickoff_at=g.kickoff_at, line_lock_at=g.line_lock_at, is_international=coalesce(g.is_international,false)
    from jsonb_to_recordset(schedule_games) g(external_game_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean)
    where saved.schedule_source is distinct from 'nflverse' and coalesce(saved.odds_event_id,saved.external_game_id)=g.external_game_id
      and (saved.kickoff_at is distinct from g.kickoff_at or saved.line_lock_at is distinct from g.line_lock_at)
    returning saved.id,saved.external_game_id)
  insert into public.audit_logs(actor_player_id,action,entity_type,entity_id,details)
  select null,'game_rescheduled','game',changed.id,jsonb_build_object('source','schedule_import','external_game_id',changed.external_game_id,
    'official_line_recheck_required',true,'imported_at',imported_at) from changed;
  insert into public.games(external_game_id,odds_event_id,schedule_source,schedule_source_event_id,scoring_period_id,away_team_id,home_team_id,kickoff_at,line_lock_at,is_international)
  select g.external_game_id,g.external_game_id,'the_odds_api',g.external_game_id,g.scoring_period_id,g.away_team_id,g.home_team_id,g.kickoff_at,g.line_lock_at,coalesce(g.is_international,false)
  from jsonb_to_recordset(schedule_games) g(external_game_id text,scoring_period_id uuid,away_team_id uuid,home_team_id uuid,kickoff_at timestamptz,line_lock_at timestamptz,is_international boolean)
  where not exists(select 1 from public.games saved where coalesce(saved.odds_event_id,saved.external_game_id)=g.external_game_id
    or (saved.schedule_source='nflverse' and saved.away_team_id=g.away_team_id and saved.home_team_id=g.home_team_id
      and abs(extract(epoch from (saved.kickoff_at-g.kickoff_at))) <= 864000));
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
    'new_weeks_assigned',assigned_week_count,'canonical_schedule_preserved',true,'imported_at',imported_at,'provider_omissions_preserved',true));
  return query select saved_game_count,saved_spread_count,assigned_week_count;
end;
$$;

revoke all on function public.import_schedule_atomically(uuid,jsonb,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.import_schedule_atomically(uuid,jsonb,jsonb,jsonb,timestamptz) to service_role;
