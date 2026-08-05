-- Season progression and scoring policy hardening.
-- The functions here are deliberately idempotent: scheduled automation can
-- retry them after an outage without creating a second handoff or rewriting
-- an audit record.

alter table public.games drop constraint if exists games_status_check;
alter table public.games add constraint games_status_check
  check (status in ('scheduled', 'live', 'final', 'postponed', 'cancelled', 'no_contest'));

-- August 1 is the pool's annual boundary in the league's Eastern time zone.
-- A season row is created only when a schedule/import workflow first reaches
-- the new year; nothing historical is overwritten.
create or replace function public.ensure_annual_season_rollover(
  evaluated_at timestamptz default clock_timestamp()
)
returns table(season_id uuid, season_year integer, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  target_year integer := extract(year from evaluated_at at time zone 'America/New_York')::integer;
  target_month integer := extract(month from evaluated_at at time zone 'America/New_York')::integer;
  existing_id uuid;
begin
  if target_month < 8 then
    target_year := target_year - 1;
  end if;

  perform pg_advisory_xact_lock(hashtext('annual-season-rollover'));
  select id into existing_id from public.seasons where year = target_year;
  if existing_id is null then
    insert into public.seasons(year, state) values (target_year, 'preseason')
    returning id into existing_id;
    insert into public.audit_logs(action, entity_type, entity_id, details)
    values ('season_created', 'season', existing_id, jsonb_build_object('year', target_year, 'automatic', true));
    return query select existing_id, target_year, true;
  else
    return query select existing_id, target_year, false;
  end if;
end;
$$;

-- A schedule move is not a disruption. Existing selections stay attached to
-- the game, but the formerly official line is released and the new lock is
-- recalculated. Final and declared-no-contest games are immutable.
create or replace function public.reschedule_game_atomically(
  target_game_id uuid,
  revised_kickoff_at timestamptz,
  revised_line_lock_at timestamptz,
  actor_player_id uuid default null
)
returns table(game_id uuid, old_kickoff_at timestamptz, new_kickoff_at timestamptz, line_reopened boolean)
language plpgsql security definer set search_path = public as $$
declare
  game_row public.games%rowtype;
  prior_line jsonb;
begin
  if revised_line_lock_at >= revised_kickoff_at then
    raise exception 'The official line lock must be earlier than kickoff.';
  end if;

  select * into game_row from public.games where id = target_game_id for update;
  if not found then raise exception 'The requested game no longer exists.'; end if;
  if game_row.status in ('final', 'cancelled', 'no_contest') then
    raise exception 'A settled or cancelled game cannot be rescheduled.';
  end if;

  select jsonb_build_object('favorite_team_id', favorite_team_id, 'locked_spread', locked_spread, 'locked_at', locked_at)
  into prior_line from public.game_lines where game_id = target_game_id;

  update public.games
  set kickoff_at = revised_kickoff_at,
      line_lock_at = revised_line_lock_at,
      status = 'scheduled'
  where id = target_game_id;
  delete from public.game_lines where game_id = target_game_id;

  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  values (
    actor_player_id, 'game_rescheduled', 'game', target_game_id,
    jsonb_build_object('old_kickoff_at', game_row.kickoff_at, 'new_kickoff_at', revised_kickoff_at,
      'old_line_lock_at', game_row.line_lock_at, 'new_line_lock_at', revised_line_lock_at,
      'released_official_line', coalesce(prior_line, '{}'::jsonb))
  );

  return query select target_game_id, game_row.kickoff_at, revised_kickoff_at, prior_line is not null;
end;
$$;

-- No contest never advances Survivor. While a suitable replacement game is
-- still available, the void remains editable; once the period has no eligible
-- replacement left, a no-contest is graded exactly like an ATS push / Survivor
-- tie: a loss. This function is safe to run repeatedly from score automation.
create or replace function public.settle_no_contest_picks(
  evaluated_at timestamptz default clock_timestamp()
)
returns table(ats_losses integer, survivor_losses integer)
language plpgsql security definer set search_path = public as $$
declare
  ats_count integer := 0;
  survivor_count integer := 0;
begin
  with candidates as (
    select p.id, p.player_id, p.scoring_period_id, p.game_id
    from public.picks p join public.games g on g.id = p.game_id
    join public.scoring_periods sp on sp.id = p.scoring_period_id
    where g.status = 'no_contest' and p.result = 'void' and sp.status <> 'complete'
      and not exists (
        select 1 from public.games candidate
        where candidate.scoring_period_id = p.scoring_period_id
          and candidate.status in ('scheduled', 'live')
          and candidate.kickoff_at > evaluated_at
          and not exists (
            select 1 from public.picks existing
            where existing.player_id = p.player_id and existing.game_id = candidate.id and existing.result <> 'void'
          )
      )
  ), updated as (
    update public.picks p set result = 'loss'
    from candidates c where p.id = c.id
    returning p.id, p.player_id, p.scoring_period_id, p.game_id
  )
  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  select player_id, 'no_contest_graded_loss', 'pick', id,
    jsonb_build_object('scoring_period_id', scoring_period_id, 'game_id', game_id, 'evaluated_at', evaluated_at)
  from updated;
  get diagnostics ats_count = row_count;

  with candidates as (
    select sp.id, se.id as entry_id, se.player_id, sp.scoring_period_id, sp.game_id
    from public.survivor_picks sp
    join public.survivor_entries se on se.id = sp.survivor_entry_id
    join public.games g on g.id = sp.game_id
    join public.scoring_periods period on period.id = sp.scoring_period_id
    where g.status = 'no_contest' and sp.result = 'void' and se.status = 'active' and period.status <> 'complete'
      and not exists (
        select 1 from public.games candidate
        where candidate.scoring_period_id = sp.scoring_period_id
          and candidate.status in ('scheduled', 'live') and candidate.kickoff_at > evaluated_at
          and not exists (
            select 1 from public.survivor_picks used_pick
            where used_pick.survivor_entry_id = se.id and used_pick.selected_team_id in (candidate.away_team_id, candidate.home_team_id)
              and used_pick.result <> 'void'
          )
      )
  ), graded as (
    update public.survivor_picks sp set result = 'loss'
    from candidates c where sp.id = c.id returning c.entry_id, c.player_id, c.scoring_period_id, c.game_id, sp.id
  ), eliminated as (
    update public.survivor_entries se
    set status = 'eliminated', eliminated_scoring_period_id = g.scoring_period_id,
        eliminated_game_id = g.game_id, eliminated_at = evaluated_at
    from graded g where se.id = g.entry_id
    returning se.id
  )
  select count(*) into survivor_count from eliminated;

  return query select ats_count, survivor_count;
end;
$$;

-- Extend the existing disruption RPC to cover declared no contests. Pending
-- picks are retained as void audit receipts first; the settlement function
-- turns them into losses only when no legal replacement remains.
create or replace function public.record_game_disruption(
  target_game_id uuid,
  disruption_status text,
  actor_player_id uuid default null
)
returns table(ats_voided integer, survivor_voided integer)
language plpgsql security definer set search_path = public as $$
declare
  game_row public.games%rowtype;
  void_result record;
begin
  if disruption_status not in ('postponed', 'cancelled', 'no_contest') then
    raise exception 'Choose postponed, cancelled, or no_contest.';
  end if;
  select * into game_row from public.games where id = target_game_id for update;
  if not found then raise exception 'The requested game no longer exists.'; end if;
  if game_row.status = 'final' then raise exception 'A final game requires the audited correction workflow.'; end if;

  update public.games set status = disruption_status where id = target_game_id;
  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  values (actor_player_id, 'game_disruption_recorded', 'game', target_game_id,
    jsonb_build_object('status', disruption_status));

  select * into void_result from public.void_disrupted_picks();
  ats_voided := coalesce(void_result.ats_voided, 0);
  survivor_voided := coalesce(void_result.survivor_voided, 0);
  if disruption_status = 'no_contest' then
    perform public.settle_no_contest_picks(clock_timestamp());
  end if;
  return next;
end;
$$;

-- Keep declared no contests in the same auditable void path as the other
-- disruptions. Settlement later determines whether a replacement was still
-- possible; it never silently advances Survivor.
create or replace function public.void_disrupted_picks()
returns table(ats_voided integer, survivor_voided integer)
language plpgsql security definer set search_path = public as $$
declare
  ats_count integer := 0;
  survivor_count integer := 0;
begin
  with voided as (
    update public.picks p set result = 'void'
    from public.games g, public.scoring_periods sp
    where p.game_id = g.id and g.scoring_period_id = sp.id
      and p.result = 'pending' and g.status in ('postponed', 'cancelled', 'no_contest')
      and sp.status <> 'complete'
    returning p.id, p.player_id, p.scoring_period_id, p.game_id, g.status as game_status
  ), audited as (
    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    select player_id, 'ats_pick_voided', 'pick', id,
      jsonb_build_object('scoring_mode', 'against_spread', 'game_id', game_id, 'reason', game_status)
    from voided returning 1
  ) select count(*) into ats_count from audited;

  with voided as (
    update public.survivor_picks p set result = 'void'
    from public.games g, public.scoring_periods sp, public.survivor_entries se
    where p.game_id = g.id and g.scoring_period_id = sp.id and se.id = p.survivor_entry_id
      and p.result = 'pending' and g.status in ('postponed', 'cancelled', 'no_contest')
      and sp.status <> 'complete'
    returning p.id, se.player_id, p.scoring_period_id, p.game_id, p.selected_team_id, g.status as game_status
  ), audited as (
    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    select player_id, 'survivor_pick_voided', 'survivor_pick', id,
      jsonb_build_object('scoring_mode', 'straight_up', 'spread_applied', false, 'game_id', game_id,
        'selected_team_id', selected_team_id, 'reason', game_status)
    from voided returning 1
  ) select count(*) into survivor_count from audited;

  return query select ats_count, survivor_count;
end;
$$;

-- Final-score corrections are audited and deliberately explicit. The service
-- workflow may set the local guard, allowing an entry affected by the corrected
-- game to be re-evaluated without opening a general reactivation loophole.
create or replace function public.prevent_survivor_entry_reactivation()
returns trigger language plpgsql as $$
begin
  if current_setting('app.allow_survivor_score_correction', true) = 'on' then
    return new;
  end if;
  if old.status in ('eliminated', 'complete') and new.status is distinct from old.status then
    raise exception 'A finalized Survivor entry cannot be reactivated or rewritten.';
  end if;
  if old.eliminated_at is not null and (
    new.eliminated_at is distinct from old.eliminated_at
    or new.eliminated_scoring_period_id is distinct from old.eliminated_scoring_period_id
    or new.eliminated_game_id is distinct from old.eliminated_game_id
  ) then
    raise exception 'Survivor elimination history cannot be rewritten.';
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_annual_season_rollover(timestamptz) from public, anon, authenticated;
revoke all on function public.reschedule_game_atomically(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.settle_no_contest_picks(timestamptz) from public, anon, authenticated;
grant execute on function public.ensure_annual_season_rollover(timestamptz) to service_role;
grant execute on function public.reschedule_game_atomically(uuid, timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.settle_no_contest_picks(timestamptz) to service_role;
