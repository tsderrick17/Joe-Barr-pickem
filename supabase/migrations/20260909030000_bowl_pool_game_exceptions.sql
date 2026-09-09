-- Bowl Pool disruptions use their own game and pick ledger. Postponed games
-- retain their picks; cancelled/no-contest games are voided and audited.
create or replace function public.record_bowl_game_disruption(
  target_game_id uuid,
  disruption_status text,
  actor_player_id uuid default null
)
returns table(picks_voided integer)
language plpgsql security definer set search_path = public as $$
declare
  game_row public.bowl_pool_games%rowtype;
  voided_count integer := 0;
begin
  if disruption_status not in ('postponed', 'cancelled', 'no_contest') then
    raise exception 'Choose postponed, cancelled, or no_contest.';
  end if;
  select * into game_row from public.bowl_pool_games where id = target_game_id for update;
  if not found then raise exception 'The requested Bowl Pool game no longer exists.'; end if;
  if game_row.status in ('final', 'no_contest', 'cancelled') then
    raise exception 'A settled or cancelled Bowl Pool game cannot be changed.';
  end if;

  update public.bowl_pool_games set status = disruption_status where id = target_game_id;

  if disruption_status in ('cancelled', 'no_contest') then
    with voided as (
      update public.bowl_pool_picks
      set result = 'void', graded_at = clock_timestamp()
      where game_id = target_game_id and result = 'pending'
      returning id, entry_id
    ), history as (
      insert into public.bowl_pool_pick_history (pick_id, entry_id, actor_player_id, action, details)
      select id, entry_id, actor_player_id, 'voided', jsonb_build_object('reason', disruption_status, 'game_id', target_game_id)
      from voided
      returning 1
    )
    select count(*) into voided_count from history;

    insert into public.bowl_pool_game_results (entry_id, game_id, result, reason, graded_at)
    select pick.entry_id, target_game_id, 'void', 'voided', clock_timestamp()
    from public.bowl_pool_picks pick
    where pick.game_id = target_game_id and pick.result = 'void'
    on conflict (entry_id, game_id) do update set result = 'void', reason = 'voided', graded_at = excluded.graded_at;
  end if;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (actor_player_id, 'bowl_game_disruption_recorded', 'bowl_pool_game', target_game_id,
    jsonb_build_object('status', disruption_status, 'picks_voided', voided_count));
  return query select voided_count;
end;
$$;

revoke all on function public.record_bowl_game_disruption(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_bowl_game_disruption(uuid, text, uuid) to service_role;
