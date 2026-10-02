-- The NFL season's length is read from the schedule feed instead of being fixed
-- at 18 weeks and 272 games, so a longer season (for example 18 games over 19
-- weeks) loads without a code change.
--
-- ensure_regular_season_weeks adds any missing regular-season week before the
-- playoff rounds, in preseason only. It never removes a week; a shorter feed
-- stops the import for commissioner review.

create or replace function public.ensure_regular_season_weeks(target_season_id uuid, week_count integer)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  existing_count integer;
  last_regular public.scoring_periods%rowtype;
  added integer;
begin
  if week_count is null or week_count < 18 or week_count > 22 then
    raise exception 'A regular season must have between 18 and 22 weeks.';
  end if;
  if not exists (select 1 from public.seasons where id = target_season_id and state = 'preseason') then
    raise exception 'Regular-season weeks can only be added in preseason.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_season_id::text || ':schedule-import', 0));

  select count(*) into existing_count
  from public.scoring_periods where season_id = target_season_id and period_type = 'regular';
  if existing_count >= week_count then
    return existing_count;
  end if;
  if exists (select 1 from public.scoring_periods where season_id = target_season_id and status <> 'upcoming') then
    raise exception 'Regular-season weeks can only be added before any week has started.';
  end if;

  select * into last_regular
  from public.scoring_periods where season_id = target_season_id and period_type = 'regular'
  order by display_order desc limit 1;
  if last_regular.id is null then
    raise exception 'The season has no regular-season template to extend.';
  end if;
  added := week_count - existing_count;

  -- Move the playoff rounds out of the way in two steps; display_order is unique.
  update public.scoring_periods set display_order = display_order + 1000
  where season_id = target_season_id and display_order > last_regular.display_order;
  update public.scoring_periods set display_order = display_order - 1000 + added
  where season_id = target_season_id and display_order > 1000;

  insert into public.scoring_periods (season_id, display_name, period_type, max_picks, status, display_order, starts_at, ends_at)
  select target_season_id, 'Week ' || (existing_count + step), 'regular', last_regular.max_picks, 'upcoming',
    last_regular.display_order + step, null, null
  from generate_series(1, added) as step;

  insert into public.audit_logs(action, entity_type, entity_id, details)
  values ('regular_season_weeks_added', 'season', target_season_id,
    jsonb_build_object('previous_weeks', existing_count, 'weeks', week_count));
  return week_count;
end;
$$;

revoke all on function public.ensure_regular_season_weeks(uuid, integer) from public, anon, authenticated;
grant execute on function public.ensure_regular_season_weeks(uuid, integer) to service_role;

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

  -- The season's shape comes from the feed: every regular-season week is
  -- assigned, at least 18 weeks and 272 games, and all 32 teams play the same
  -- number of games (17 today; 18 if the league lengthens the season).
  if (select count(*) from jsonb_to_recordset(period_assignments) as a(scoring_period_id uuid))
      <> (select count(*) from public.scoring_periods where season_id = target_season_id and period_type = 'regular')
    or (select count(*) from jsonb_to_recordset(period_assignments) as a(scoring_period_id uuid)) < 18
    or (select count(*) from jsonb_to_recordset(schedule_games) as g(external_game_id text)) < 272 then
    raise exception 'A full preseason import must assign every regular-season week (at least 18) and include at least 272 games.';
  end if;
  if (
    with appearances as (
      select team_id, count(*) as games
      from (
        select g.away_team_id as team_id from jsonb_to_recordset(schedule_games) as g(away_team_id uuid)
        union all
        select g.home_team_id from jsonb_to_recordset(schedule_games) as g(home_team_id uuid)
      ) teams
      group by team_id
    )
    select count(*) <> 32 or count(distinct games) <> 1 or min(games) < 17 from appearances
  ) then
    raise exception 'A full preseason import requires all 32 teams to play the same number of games.';
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
      'expected_games', (select count(*) from jsonb_to_recordset(schedule_games) as g(external_game_id text)), 'imported_at', imported_at));
  return query select saved_count, matched_count, assigned_count;
end;
$$;

revoke all on function public.import_full_schedule_atomically(uuid, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.import_full_schedule_atomically(uuid, jsonb, jsonb, timestamptz) to service_role;

create or replace function public.reconcile_full_schedule_atomically(
  target_season_id uuid,
  schedule_games jsonb,
  imported_at timestamptz default clock_timestamp()
)
returns table(rescheduled_games integer, review_games integer)
language plpgsql security definer set search_path = public as $$
declare
  changed_count integer := 0;
  review_count integer := 0;
begin
  -- The provider must carry exactly the season's canonical games, however many
  -- the season has; the identity check below also requires the same set.
  if jsonb_typeof(schedule_games) is distinct from 'array'
    or (select count(*) from jsonb_to_recordset(schedule_games) as game(schedule_source_event_id text))
      <> (select count(*) from public.games saved
          join public.scoring_periods period on period.id = saved.scoring_period_id
          where saved.schedule_source = 'nflverse' and period.season_id = target_season_id) then
    raise exception 'A live full-schedule reconciliation must carry exactly the season''s canonical games.';
  end if;
  if not exists (select 1 from public.seasons where id = target_season_id) then
    raise exception 'The reconciliation season does not exist.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_season_id::text || ':schedule-import', 0));

  if exists (
    select 1
    from jsonb_to_recordset(schedule_games) as incoming(
      schedule_source_event_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean
    )
    left join public.scoring_periods as period on period.id = incoming.scoring_period_id
    where incoming.schedule_source_event_id is null or incoming.scoring_period_id is null
      or incoming.away_team_id is null or incoming.home_team_id is null
      or incoming.kickoff_at is null or incoming.line_lock_at is null
      or incoming.line_lock_at >= incoming.kickoff_at
      or incoming.away_team_id = incoming.home_team_id
      or period.season_id <> target_season_id or period.period_type <> 'regular'
  ) then raise exception 'The full provider returned an invalid schedule game.'; end if;

  if exists (
    select schedule_source_event_id from jsonb_to_recordset(schedule_games) as incoming(schedule_source_event_id text)
    group by schedule_source_event_id having count(*) > 1
  ) then raise exception 'The full provider repeated a schedule game identifier.'; end if;

  -- The source identity is immutable. An unknown or duplicated source event
  -- must stop the run rather than letting a changed provider shape rewrite data.
  if exists (
    select 1 from jsonb_to_recordset(schedule_games) as incoming(schedule_source_event_id text)
    left join public.games as saved on saved.schedule_source = 'nflverse'
      and saved.schedule_source_event_id = incoming.schedule_source_event_id
    where saved.id is null
  ) or exists (
    select 1 from public.games as saved
    where saved.schedule_source = 'nflverse'
      and exists (select 1 from public.scoring_periods as period where period.id = saved.scoring_period_id and period.season_id = target_season_id)
      and not exists (select 1 from jsonb_to_recordset(schedule_games) as incoming(schedule_source_event_id text)
        where incoming.schedule_source_event_id = saved.schedule_source_event_id)
  ) then raise exception 'Schedule review required: the provider no longer matches the canonical game identity set.'; end if;

  with differences as (
    select saved.id as game_id,
      case
        when saved.away_team_id <> incoming.away_team_id or saved.home_team_id <> incoming.home_team_id then 'team_identity_change'
        when saved.scoring_period_id <> incoming.scoring_period_id then 'scoring_period_change'
        else 'timing_after_lock'
      end as review_type,
      jsonb_build_object('scoring_period_id', saved.scoring_period_id, 'away_team_id', saved.away_team_id,
        'home_team_id', saved.home_team_id, 'kickoff_at', saved.kickoff_at, 'line_lock_at', saved.line_lock_at,
        'status', saved.status, 'gameweek_key', saved.gameweek_key) as saved_snapshot,
      jsonb_build_object('scoring_period_id', incoming.scoring_period_id, 'away_team_id', incoming.away_team_id,
        'home_team_id', incoming.home_team_id, 'kickoff_at', incoming.kickoff_at, 'line_lock_at', incoming.line_lock_at) as provider_snapshot
    from public.games as saved
    join jsonb_to_recordset(schedule_games) as incoming(
      schedule_source_event_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean
    ) on saved.schedule_source = 'nflverse' and saved.schedule_source_event_id = incoming.schedule_source_event_id
    where saved.scoring_period_id <> incoming.scoring_period_id
      or saved.away_team_id <> incoming.away_team_id or saved.home_team_id <> incoming.home_team_id
      or ((saved.kickoff_at is distinct from incoming.kickoff_at or saved.line_lock_at is distinct from incoming.line_lock_at)
        and (saved.status <> 'scheduled' or saved.line_lock_at <= imported_at))
  ), upserted as (
    insert into public.schedule_change_reviews(game_id, review_type, saved_snapshot, provider_snapshot)
    select game_id, review_type, saved_snapshot, provider_snapshot from differences
    on conflict (game_id, review_type) where resolved_at is null do update
      set last_seen_at = imported_at, saved_snapshot = excluded.saved_snapshot, provider_snapshot = excluded.provider_snapshot
    returning game_id
  ) select count(*) into review_count from upserted;

  -- If a provider corrects itself back to the saved value, close the alert.
  update public.schedule_change_reviews as review set resolved_at = imported_at, last_seen_at = imported_at
  where review.resolved_at is null and not exists (
    select 1 from public.games as saved
    join jsonb_to_recordset(schedule_games) as incoming(
      schedule_source_event_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean
    ) on saved.schedule_source = 'nflverse' and saved.schedule_source_event_id = incoming.schedule_source_event_id
    where saved.id = review.game_id and (
      saved.scoring_period_id <> incoming.scoring_period_id
      or saved.away_team_id <> incoming.away_team_id or saved.home_team_id <> incoming.home_team_id
      or ((saved.kickoff_at is distinct from incoming.kickoff_at or saved.line_lock_at is distinct from incoming.line_lock_at)
        and (saved.status <> 'scheduled' or saved.line_lock_at <= imported_at))
    )
  );

  delete from public.game_lines as line using public.games as saved,
    jsonb_to_recordset(schedule_games) as incoming(
      schedule_source_event_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean
    )
  where line.game_id = saved.id and saved.schedule_source = 'nflverse'
    and saved.schedule_source_event_id = incoming.schedule_source_event_id
    and saved.scoring_period_id = incoming.scoring_period_id
    and saved.away_team_id = incoming.away_team_id and saved.home_team_id = incoming.home_team_id
    and saved.status = 'scheduled' and saved.line_lock_at > imported_at
    and (saved.kickoff_at is distinct from incoming.kickoff_at or saved.line_lock_at is distinct from incoming.line_lock_at);

  with changed as (
    update public.games as saved set kickoff_at = incoming.kickoff_at,
      line_lock_at = incoming.line_lock_at, is_international = coalesce(incoming.is_international, false)
    from jsonb_to_recordset(schedule_games) as incoming(
      schedule_source_event_id text, scoring_period_id uuid, away_team_id uuid,
      home_team_id uuid, kickoff_at timestamptz, line_lock_at timestamptz, is_international boolean
    )
    where saved.schedule_source = 'nflverse' and saved.schedule_source_event_id = incoming.schedule_source_event_id
      and saved.scoring_period_id = incoming.scoring_period_id
      and saved.away_team_id = incoming.away_team_id and saved.home_team_id = incoming.home_team_id
      and saved.status = 'scheduled' and saved.line_lock_at > imported_at
      and (saved.kickoff_at is distinct from incoming.kickoff_at or saved.line_lock_at is distinct from incoming.line_lock_at)
    returning saved.id, saved.external_game_id
  ), audited as (
    insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
    select null, 'game_rescheduled', 'game', changed.id,
      jsonb_build_object('source', 'nflverse_full_schedule_reconciliation', 'external_game_id', changed.external_game_id,
        'official_line_recheck_required', true, 'imported_at', imported_at)
    from changed returning entity_id
  ) select count(*) into changed_count from audited;

  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  values (null, 'schedule_reconciled', 'season', target_season_id,
    jsonb_build_object('provider', 'nflverse', 'rescheduled_games', changed_count,
      'review_games', review_count, 'provider_omissions_preserved', true, 'imported_at', imported_at));
  return query select changed_count, review_count;
end;
$$;

revoke all on function public.reconcile_full_schedule_atomically(uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_full_schedule_atomically(uuid, jsonb, timestamptz) to service_role;
