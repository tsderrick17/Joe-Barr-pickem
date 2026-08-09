-- The full preseason file remains the canonical schedule source after Week 1.
-- Live reconciliation changes only an unlocked future kickoff. Everything else
-- is kept intact and placed in a small commissioner review queue.
create table public.schedule_change_reviews (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  review_type text not null check (review_type in ('timing_after_lock', 'scoring_period_change', 'team_identity_change')),
  detected_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  saved_snapshot jsonb not null,
  provider_snapshot jsonb not null
);

create unique index schedule_change_reviews_one_open_idx
  on public.schedule_change_reviews(game_id, review_type) where resolved_at is null;
create index schedule_change_reviews_open_idx
  on public.schedule_change_reviews(detected_at desc) where resolved_at is null;
alter table public.schedule_change_reviews enable row level security;
revoke all on table public.schedule_change_reviews from public, anon, authenticated;

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
  if jsonb_typeof(schedule_games) is distinct from 'array'
    or (select count(*) from jsonb_to_recordset(schedule_games) as game(schedule_source_event_id text)) <> 272 then
    raise exception 'A live full-schedule reconciliation requires exactly 272 games.';
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
  ) then raise exception 'Schedule review required: the provider no longer matches the canonical 272-game identity set.'; end if;

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
