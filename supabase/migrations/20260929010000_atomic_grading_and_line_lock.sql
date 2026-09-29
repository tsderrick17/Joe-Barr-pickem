-- Make three multi-step writes all-or-nothing. Each function below runs as one
-- statement/transaction, so a failure leaves the previous state untouched and a
-- retry starts from a clean, known position.
--
-- 1. recover_pending_ats_grades: NFL ATS grade recovery was previously issued
--    from the application as several separate picks updates.
-- 2. grade_bowl_pool_final_picks: Bowl grading wrote each pick and its result
--    receipt separately. A failed receipt write left a graded pick with no
--    receipt that could never be retried because only pending picks were read.
-- 3. lock_official_lines_atomically: an official line, its preliminary-history
--    snapshot, and its audit entry are now saved together.
--
-- Grading rules are unchanged: a cover is a win; an ATS push is a loss; a Bowl
-- PK (spread 0) is decided straight up and a tie is a loss.

create or replace function public.recover_pending_ats_grades()
returns table(picks_graded integer, picks_awaiting_line integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with final_picks as (
    select
      pick.id as pick_id,
      pick.selected_team_id,
      game.away_team_id,
      game.home_team_id,
      game.away_score,
      game.home_score,
      line.favorite_team_id,
      line.locked_spread
    from public.picks pick
    join public.games game on game.id = pick.game_id
    left join public.game_lines line on line.game_id = game.id
    where pick.result = 'pending'
      and game.status = 'final'
      and game.away_score is not null
      and game.home_score is not null
  ), decided as (
    select
      pick_id,
      case
        when favorite_team_id is null
          or locked_spread is null
          or selected_team_id not in (away_team_id, home_team_id) then null
        when (
          case when selected_team_id = away_team_id then away_score - home_score
               else home_score - away_score end
          + case when selected_team_id = favorite_team_id then -locked_spread
                 else locked_spread end
        ) > 0 then 'win'
        else 'loss'
      end as grade
    from final_picks
  ), updated as (
    update public.picks as pick
    set result = decided.grade
    from decided
    where pick.id = decided.pick_id
      and pick.result = 'pending'
      and decided.grade is not null
    returning pick.id
  )
  select
    (select count(*) from updated)::integer,
    (select count(*) from decided where grade is null)::integer;
end;
$$;

create or replace function public.grade_bowl_pool_final_picks(
  evaluated_at timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  graded_count integer;
begin
  if evaluated_at is null or evaluated_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The Bowl Pool grading time is invalid.';
  end if;

  with final_picks as (
    select
      pick.id as pick_id,
      pick.entry_id,
      pick.game_id,
      pick.selected_team_id,
      game.away_team_id,
      game.home_team_id,
      game.away_score,
      game.home_score,
      line.favorite_team_id,
      line.locked_spread
    from public.bowl_pool_picks pick
    join public.bowl_pool_games game on game.id = pick.game_id
    join public.bowl_pool_game_lines line on line.game_id = game.id
    where pick.result = 'pending'
      and game.status = 'final'
      and game.away_score is not null
      and game.home_score is not null
      and pick.selected_team_id in (game.away_team_id, game.home_team_id)
  ), decided as (
    select
      pick_id,
      entry_id,
      game_id,
      case
        when locked_spread = 0 then
          case when (case when selected_team_id = away_team_id then away_score - home_score
                          else home_score - away_score end) > 0 then 'win' else 'loss' end
        when favorite_team_id is null then null
        when (
          case when selected_team_id = away_team_id then away_score - home_score
               else home_score - away_score end
          + case when selected_team_id = favorite_team_id then -locked_spread
                 else locked_spread end
        ) > 0 then 'win'
        else 'loss'
      end as grade
    from final_picks
  ), updated as (
    update public.bowl_pool_picks as pick
    set result = decided.grade, graded_at = evaluated_at
    from decided
    where pick.id = decided.pick_id
      and pick.result = 'pending'
      and decided.grade is not null
    returning pick.entry_id, pick.game_id, pick.result
  ), receipts as (
    insert into public.bowl_pool_game_results (entry_id, game_id, result, reason, graded_at)
    select entry_id, game_id, result, 'graded', evaluated_at from updated
    on conflict (entry_id, game_id) do update
      set result = excluded.result, reason = 'graded', graded_at = excluded.graded_at
    returning 1
  )
  select count(*) into graded_count from updated;

  -- Repair receipts stranded by the earlier two-step write: a graded pick whose
  -- receipt was never saved. Safe to repeat; existing receipts are untouched.
  insert into public.bowl_pool_game_results (entry_id, game_id, result, reason, graded_at)
  select pick.entry_id, pick.game_id, pick.result, 'graded', coalesce(pick.graded_at, evaluated_at)
  from public.bowl_pool_picks pick
  where pick.result in ('win', 'loss')
    and not exists (
      select 1 from public.bowl_pool_game_results receipt
      where receipt.entry_id = pick.entry_id and receipt.game_id = pick.game_id
    )
  on conflict (entry_id, game_id) do nothing;

  return graded_count;
end;
$$;

create or replace function public.lock_official_lines_atomically(
  decisions jsonb,
  locked_at timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_count integer;
begin
  if jsonb_typeof(decisions) is distinct from 'array' then
    raise exception 'Official line decisions must be submitted as an array.';
  end if;
  if locked_at is null or locked_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The official line lock time is invalid.';
  end if;

  with incoming as (
    select *
    from jsonb_to_recordset(decisions) as item(
      game_id uuid,
      favorite_team_id uuid,
      spread numeric,
      source text,
      source_captured_at timestamptz,
      used_fallback boolean,
      pick_em boolean,
      record_history boolean
    )
  ), history as (
    insert into public.spread_history (game_id, favorite_team_id, spread, source, captured_at)
    select game_id, favorite_team_id, spread, source, source_captured_at
    from incoming
    where coalesce(record_history, false)
    returning 1
  ), inserted as (
    insert into public.game_lines (
      game_id, favorite_team_id, locked_spread, source,
      source_captured_at, locked_at, manual_override
    )
    select game_id, favorite_team_id, spread, source, source_captured_at, lock_official_lines_atomically.locked_at, false
    from incoming
    on conflict (game_id) do nothing
    returning game_id
  ), audited as (
    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    select
      null,
      'official_line_locked',
      'game',
      incoming.game_id,
      jsonb_build_object(
        'spread', incoming.spread,
        'source', incoming.source,
        'source_captured_at', incoming.source_captured_at,
        'used_fallback', coalesce(incoming.used_fallback, false),
        'pick_em', coalesce(incoming.pick_em, false)
      )
    from incoming
    join inserted on inserted.game_id = incoming.game_id
    returning 1
  )
  select count(*) into locked_count from inserted;

  return locked_count;
end;
$$;

revoke all on function public.recover_pending_ats_grades() from public, anon, authenticated;
revoke all on function public.grade_bowl_pool_final_picks(timestamptz) from public, anon, authenticated;
revoke all on function public.lock_official_lines_atomically(jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.recover_pending_ats_grades() to service_role;
grant execute on function public.grade_bowl_pool_final_picks(timestamptz) to service_role;
grant execute on function public.lock_official_lines_atomically(jsonb, timestamptz) to service_role;
