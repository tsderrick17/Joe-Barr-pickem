-- Close the remaining timing gaps around future-week submissions, playoff-day
-- eligibility, reminder recovery, PIN enumeration, and disrupted games. Every
-- operation is forward-only and safe to retry through the migration runner.

create or replace function public.assert_scoring_period_accepts_picks(
  target_scoring_period_id uuid,
  evaluated_at timestamptz default clock_timestamp()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period public.scoring_periods%rowtype;
  active_period public.scoring_periods%rowtype;
  active_game_count integer := 0;
  active_games_settled boolean := false;
  settlement_at timestamptz;
  manual_access_at timestamptz;
begin
  if evaluated_at is null or evaluated_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The pick-window evaluation time is invalid.';
  end if;

  select * into target_period
  from public.scoring_periods
  where id = target_scoring_period_id;
  if not found then raise exception 'That scoring period does not exist.'; end if;
  if target_period.status = 'complete' then raise exception 'This completed week is read-only.'; end if;
  if target_period.status = 'active' then return; end if;
  if target_period.status <> 'upcoming' then raise exception 'That Slate is not open for selections.'; end if;

  select * into active_period
  from public.scoring_periods
  where season_id = target_period.season_id and status = 'active'
  order by display_order
  limit 1;

  -- Before Week 1 activates, only the season's first upcoming period is the
  -- current player-facing Slate. Later future periods remain sealed.
  if active_period.id is null then
    if target_period.display_order = (
      select min(display_order) from public.scoring_periods
      where season_id = target_period.season_id and status = 'upcoming'
    ) then
      return;
    end if;
    raise exception 'Only the current Slate may accept selections.';
  end if;

  if target_period.display_order <> active_period.display_order + 1 then
    raise exception 'Only the immediate next Slate may open early.';
  end if;

  select
    count(*)::integer,
    bool_and(
      game.status in ('final', 'postponed', 'cancelled', 'no_contest')
      and (game.status <> 'final' or game.finalized_at is not null)
    ),
    max(coalesce(game.finalized_at, game.kickoff_at))
  into active_game_count, active_games_settled, settlement_at
  from public.games game
  where game.scoring_period_id = active_period.id;

  if active_game_count = 0 or not coalesce(active_games_settled, false) or settlement_at is null then
    raise exception 'The next Slate cannot open until the current one is settled.';
  end if;

  manual_access_at := (
    ((settlement_at at time zone 'America/New_York')::date + 1)::timestamp
      at time zone 'America/New_York'
  );
  if evaluated_at < manual_access_at then
    raise exception 'The next Slate opens on the next Eastern calendar day.';
  end if;
end;
$$;

revoke all on function public.assert_scoring_period_accepts_picks(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.assert_scoring_period_accepts_picks(uuid, timestamptz)
  to service_role;

create or replace function public.validate_pick()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  game_period_id uuid;
  game_away_team_id uuid;
  game_home_team_id uuid;
  game_kickoff_at timestamptz;
  game_status text;
  allowed_pick_count integer;
  existing_pick_count integer;
begin
  perform public.assert_scoring_period_accepts_picks(new.scoring_period_id);
  select scoring_period_id, away_team_id, home_team_id, kickoff_at, status
  into game_period_id, game_away_team_id, game_home_team_id, game_kickoff_at, game_status
  from public.games where id = new.game_id;

  if game_period_id is null then raise exception 'The selected game does not exist.'; end if;
  if new.scoring_period_id is distinct from game_period_id then raise exception 'A pick must belong to the game''s assigned week.'; end if;
  if new.selected_team_id not in (game_away_team_id, game_home_team_id) then raise exception 'A pick must select one of the two teams in that game.'; end if;
  if game_status <> 'scheduled' then raise exception 'That game is no longer open for selections.'; end if;
  if clock_timestamp() >= game_kickoff_at then raise exception 'That game has already started.'; end if;

  select max_picks into allowed_pick_count from public.scoring_periods where id = new.scoring_period_id;
  select count(*) into existing_pick_count
  from public.picks
  where player_id = new.player_id and scoring_period_id = new.scoring_period_id
    and result <> 'void' and id is distinct from new.id;
  if existing_pick_count >= allowed_pick_count then raise exception 'This player already has the maximum number of picks for the week.'; end if;
  return new;
end;
$$;

create or replace function public.validate_survivor_pick()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  game_period_id uuid;
  game_away_team_id uuid;
  game_home_team_id uuid;
  game_kickoff_at timestamptz;
  game_status text;
  entry_season_id uuid;
  entry_status text;
  period_season_id uuid;
begin
  perform public.assert_scoring_period_accepts_picks(new.scoring_period_id);
  select scoring_period_id, away_team_id, home_team_id, kickoff_at, status
  into game_period_id, game_away_team_id, game_home_team_id, game_kickoff_at, game_status
  from public.games where id = new.game_id;

  if game_period_id is null or new.scoring_period_id is distinct from game_period_id then
    raise exception 'A Survivor pick must belong to the selected game''s week.';
  end if;
  if new.selected_team_id not in (game_away_team_id, game_home_team_id) then
    raise exception 'A Survivor pick must select one of the two teams in that game.';
  end if;
  if game_status <> 'scheduled' then raise exception 'That Survivor game is no longer open for selections.'; end if;
  if clock_timestamp() >= game_kickoff_at then raise exception 'That Survivor game has already started.'; end if;

  select season_id, status into entry_season_id, entry_status
  from public.survivor_entries where id = new.survivor_entry_id;
  select season_id into period_season_id from public.scoring_periods where id = new.scoring_period_id;
  if entry_season_id is null or entry_season_id is distinct from period_season_id then
    raise exception 'The Survivor entry does not belong to this season.';
  end if;
  if entry_status is distinct from 'active' then raise exception 'This Survivor entry is no longer active.'; end if;
  return new;
end;
$$;

-- Keep the application-facing replacement RPCs, but place the same database
-- pick-window assertion in front of both their insert and clear paths. This
-- prevents an older or alternate server route from editing a sealed week.
alter function public.replace_unlocked_picks(uuid, uuid, jsonb)
  rename to replace_unlocked_picks_unchecked_20260826;

create or replace function public.replace_unlocked_picks(
  target_player_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_scoring_period_accepts_picks(target_scoring_period_id);
  perform public.replace_unlocked_picks_unchecked_20260826(
    target_player_id,
    target_scoring_period_id,
    replacement_picks
  );
end;
$$;

alter function public.replace_unlocked_survivor_pick(uuid, uuid, jsonb)
  rename to replace_unlocked_survivor_pick_unchecked_20260826;

create or replace function public.replace_unlocked_survivor_pick(
  target_survivor_entry_id uuid,
  target_scoring_period_id uuid,
  replacement_pick jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_scoring_period_accepts_picks(target_scoring_period_id);
  perform public.replace_unlocked_survivor_pick_unchecked_20260826(
    target_survivor_entry_id,
    target_scoring_period_id,
    replacement_pick
  );
end;
$$;

revoke all on function public.replace_unlocked_picks_unchecked_20260826(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.replace_unlocked_survivor_pick_unchecked_20260826(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.replace_unlocked_picks(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.replace_unlocked_survivor_pick(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_unlocked_picks(uuid, uuid, jsonb) to service_role;
grant execute on function public.replace_unlocked_survivor_pick(uuid, uuid, jsonb) to service_role;

-- Keep the prior, fully audited eligibility calculation intact, but place a
-- settlement gate in front of it. A page view on Tuesday may not freeze the
-- following Saturday, and a delayed prior-day final may not freeze today.
alter function public.snapshot_playoff_day_eligibility_implementation(uuid, timestamptz)
  rename to snapshot_playoff_day_eligibility_unchecked_20260826;

create or replace function public.snapshot_playoff_day_eligibility_implementation(
  target_scoring_period_id uuid,
  evaluated_at timestamptz default clock_timestamp()
)
returns table(
  snapshot_day date,
  players_eligible integer,
  players_eliminated integer,
  picks_scratched integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period public.scoring_periods%rowtype;
  eastern_today date := (evaluated_at at time zone 'America/New_York')::date;
begin
  select * into target_period
  from public.scoring_periods
  where id = target_scoring_period_id
    and period_type = 'playoff'
    and status = 'active';
  if not found then
    return query select null::date, 0, 0, 0;
    return;
  end if;

  if exists (
    select 1 from public.playoff_day_eligibility eligibility
    where eligibility.scoring_period_id = target_scoring_period_id
      and eligibility.game_day = eastern_today
  ) then
    return query select eastern_today, 0, 0, 0;
    return;
  end if;

  if not exists (
    select 1 from public.games game
    where game.scoring_period_id = target_scoring_period_id
      and (game.kickoff_at at time zone 'America/New_York')::date = eastern_today
      and game.status not in ('postponed', 'cancelled', 'no_contest')
  ) then
    return query select null::date, 0, 0, 0;
    return;
  end if;

  if exists (
    select 1
    from public.games game
    join public.scoring_periods period on period.id = game.scoring_period_id
    where period.season_id = target_period.season_id
      and (game.kickoff_at at time zone 'America/New_York')::date < eastern_today
      and (
        game.status in ('scheduled', 'live')
        or (game.status = 'final' and game.finalized_at is null)
      )
  ) or exists (
    select 1
    from public.picks pick
    join public.games game on game.id = pick.game_id
    join public.scoring_periods period on period.id = game.scoring_period_id
    where period.season_id = target_period.season_id
      and (game.kickoff_at at time zone 'America/New_York')::date < eastern_today
      and pick.result = 'pending'
  ) then
    return query select null::date, 0, 0, 0;
    return;
  end if;

  return query
  select * from public.snapshot_playoff_day_eligibility_unchecked_20260826(
    target_scoring_period_id,
    evaluated_at
  );
end;
$$;

revoke all on function public.snapshot_playoff_day_eligibility_unchecked_20260826(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.snapshot_playoff_day_eligibility_implementation(uuid, timestamptz)
  from public, anon, authenticated;

-- A crashed worker may safely reclaim a parent reminder only when no recipient
-- delivery receipt exists. Once any receipt exists, the uncertain state stays
-- visible for commissioner review rather than risking a duplicate email.
create or replace function public.claim_due_push_reminders()
returns setof public.push_reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_reminders reminder
  set status = 'scheduled', processing_started_at = null,
      scheduled_for = clock_timestamp(), updated_at = clock_timestamp()
  where reminder.status = 'sending'
    and reminder.processing_started_at < clock_timestamp() - interval '20 minutes'
    and not exists (
      select 1 from public.email_reminder_deliveries delivery
      where delivery.reminder_id = reminder.id
    );

  return query
  with due as (
    select id from public.push_reminders
    where status = 'scheduled' and scheduled_for <= clock_timestamp()
    order by scheduled_for, created_at
    limit 3
    for update skip locked
  )
  update public.push_reminders reminder
  set status = 'sending', processing_started_at = clock_timestamp(), updated_at = clock_timestamp()
  from due
  where reminder.id = due.id
  returning reminder.*;
end;
$$;

revoke all on function public.claim_due_push_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_push_reminders() to service_role;

create or replace function public.pin_login_cooldown_seconds(
  attempt_source_fingerprint text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_attempts integer := 0;
  last_attempt_at timestamptz;
  cooldown_until timestamptz;
begin
  if attempt_source_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid PIN-login security source.';
  end if;

  select count(*)::integer, max(attempted_at)
  into recent_attempts, last_attempt_at
  from public.pin_login_attempts
  where source_fingerprint = attempt_source_fingerprint
    and attempted_at >= clock_timestamp() - interval '15 minutes';

  if recent_attempts >= 10 then
    cooldown_until := last_attempt_at + interval '15 minutes';
  elsif recent_attempts >= 5 then
    cooldown_until := last_attempt_at + interval '1 minute';
  else
    return 0;
  end if;

  return greatest(0, ceil(extract(epoch from cooldown_until - clock_timestamp()))::integer);
end;
$$;

revoke all on function public.pin_login_cooldown_seconds(text)
  from public, anon, authenticated;
grant execute on function public.pin_login_cooldown_seconds(text)
  to service_role;

-- Cancelled and no-contest selections are auditable voids, not losses. The
-- user met the selection obligation; Survivor must not later reinterpret that
-- void as a missing pick.
create or replace function public.settle_no_contest_picks(
  evaluated_at timestamptz default clock_timestamp()
)
returns table(ats_losses integer, survivor_losses integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if evaluated_at is null or evaluated_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The no-contest settlement time is invalid.';
  end if;
  return query select 0, 0;
end;
$$;

create or replace function public.eliminate_survivor_no_picks(
  evaluated_at timestamptz default clock_timestamp()
)
returns table(entries_eliminated integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  eliminated_count integer := 0;
begin
  if evaluated_at is null or evaluated_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The Survivor no-pick evaluation time is invalid.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('survivor-no-pick-evaluation', 0));

  with closed_periods as (
    select period.id, period.season_id, period.display_order,
      max(game.kickoff_at) as final_kickoff_at
    from public.scoring_periods period
    join public.games game on game.scoring_period_id = period.id
      and game.status not in ('postponed', 'cancelled', 'no_contest')
    group by period.id, period.season_id, period.display_order
    having max(game.kickoff_at) <= evaluated_at
  ), overdue_entries as (
    select distinct on (entry.id) entry.id as entry_id, period.id as scoring_period_id
    from public.survivor_entries entry
    join closed_periods period on period.season_id = entry.season_id
      and entry.entered_at <= period.final_kickoff_at
    where entry.status = 'active'
      and not exists (
        select 1 from public.survivor_picks survivor_pick
        where survivor_pick.survivor_entry_id = entry.id
          and survivor_pick.scoring_period_id = period.id
      )
    order by entry.id, period.display_order
  ), eliminated as (
    update public.survivor_entries entry
    set status = 'eliminated', eliminated_scoring_period_id = overdue.scoring_period_id,
        eliminated_game_id = null, eliminated_at = evaluated_at
    from overdue_entries overdue
    where entry.id = overdue.entry_id and entry.status = 'active'
    returning entry.id, entry.player_id, entry.eliminated_scoring_period_id
  ), audited as (
    insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
    select null, 'survivor_no_pick_eliminated', 'survivor_entry', eliminated.id,
      jsonb_build_object('player_id', eliminated.player_id,
        'scoring_period_id', eliminated.eliminated_scoring_period_id,
        'reason', 'No Survivor selection was made before the final eligible kickoff.')
    from eliminated returning 1
  )
  select count(*) into eliminated_count from audited;
  return query select eliminated_count;
end;
$$;

revoke all on function public.settle_no_contest_picks(timestamptz)
  from public, anon, authenticated;
revoke all on function public.eliminate_survivor_no_picks(timestamptz)
  from public, anon, authenticated;
grant execute on function public.settle_no_contest_picks(timestamptz)
  to service_role;
grant execute on function public.eliminate_survivor_no_picks(timestamptz)
  to service_role;
