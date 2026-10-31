-- A Bowl game ESPN lists as cancelled is cancelled here too, without waiting for the Commissioner.
--
-- The Bowl worker confirms the cancellation on two runs in a row before acting: espn_cancelled_seen_at holds the first sighting and is cleared the moment
-- ESPN stops saying "cancelled", so a single odd answer from ESPN changes nothing. The cancellation itself is the one the Commissioner's button records
-- (record_bowl_game_disruption: picks voided, history, results, audit), done in the same call as an open schedule-change row that carries the reason, so the
-- Commissioner's panel and the readiness tile show it until they mark it reviewed.
alter table public.bowl_pool_games add column if not exists espn_cancelled_seen_at timestamptz;
alter table public.bowl_pool_schedule_changes add column if not exists reason text;

create or replace function public.record_bowl_game_cancelled_by_espn(target_game_id uuid)
returns table(picks_voided integer)
language plpgsql security definer set search_path = public as $$
declare
  game_row public.bowl_pool_games%rowtype;
  voided_count integer;
begin
  select * into game_row from public.bowl_pool_games where id = target_game_id;
  if not found then raise exception 'The requested Bowl Pool game no longer exists.'; end if;
  select disruption.picks_voided into voided_count from public.record_bowl_game_disruption(target_game_id, 'cancelled', null) disruption;
  insert into public.bowl_pool_schedule_changes (game_id, old_kickoff_at, new_kickoff_at, reason)
  values (target_game_id, game_row.kickoff_at, game_row.kickoff_at,
    format('%s was cancelled automatically because ESPN lists it as cancelled. %s %s voided.', game_row.bowl_name, voided_count, case when voided_count = 1 then 'pick was' else 'picks were' end));
  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (null, 'bowl_game_cancelled_by_espn', 'bowl_pool_game', target_game_id, jsonb_build_object('picks_voided', voided_count));
  return query select voided_count;
end;
$$;

revoke all on function public.record_bowl_game_cancelled_by_espn(uuid) from public, anon, authenticated;
grant execute on function public.record_bowl_game_cancelled_by_espn(uuid) to service_role;
