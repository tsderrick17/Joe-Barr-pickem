-- Commissioners can restore a postponed game with a new kickoff while
-- preserving its picks and leaving cancelled/no-contest games terminal.
create or replace function public.reschedule_bowl_game(target_game_id uuid, new_kickoff_at timestamptz, actor_player_id uuid)
returns public.bowl_pool_games language plpgsql security definer set search_path = public as $$
declare game_row public.bowl_pool_games%rowtype;
begin
  if not exists (select 1 from players where id=actor_player_id and is_commissioner=true and active=true) then raise exception 'Commissioner access is required.'; end if;
  select * into game_row from bowl_pool_games where id=target_game_id for update;
  if game_row.id is null then raise exception 'Bowl Pool game was not found.'; end if;
  if game_row.status <> 'postponed' then raise exception 'Only postponed Bowl games can be rescheduled.'; end if;
  if new_kickoff_at <= clock_timestamp() then raise exception 'The new Bowl kickoff must be in the future.'; end if;
  update bowl_pool_games set kickoff_at=new_kickoff_at, line_lock_at=new_kickoff_at, status='scheduled', finalized_at=null where id=target_game_id returning * into game_row;
  return game_row;
end; $$;

revoke all on function public.reschedule_bowl_game(uuid,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.reschedule_bowl_game(uuid,timestamptz,uuid) to service_role;
