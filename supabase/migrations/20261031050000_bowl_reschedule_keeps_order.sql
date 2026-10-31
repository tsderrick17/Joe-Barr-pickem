-- A rescheduled Bowl game takes its place by kickoff.
--
-- The Bowl lists (the Bowl Card, the picks page, the standings) read games by order_index, and the schedule pull already renumbers that
-- order when a game is added or a kickoff changes. reschedule_bowl_game moved only the kickoff, so a postponed game moved to a later
-- day kept its old place and sat out of date order. It now renumbers by kickoff at the end, but only when the season's list was in
-- kickoff order to begin with, so an order the Commissioner arranged by hand is left as it was (the same rule the schedule pull uses).
-- Everything else in the function is unchanged. create or replace keeps the existing grants.
create or replace function public.reschedule_bowl_game(target_game_id uuid, new_kickoff_at timestamptz, actor_player_id uuid)
returns public.bowl_pool_games language plpgsql security definer set search_path = public as $$
declare game_row public.bowl_pool_games%rowtype; was_chronological boolean;
begin
  if not exists (select 1 from players where id=actor_player_id and is_commissioner=true and active=true) then raise exception 'Commissioner access is required.'; end if;
  select * into game_row from bowl_pool_games where id=target_game_id for update;
  if game_row.id is null then raise exception 'Bowl Pool game was not found.'; end if;
  if game_row.status <> 'postponed' then raise exception 'Only postponed Bowl games can be rescheduled.'; end if;
  if new_kickoff_at <= clock_timestamp() then raise exception 'The new Bowl kickoff must be in the future.'; end if;
  -- Read before the move: a minute of slack, like the schedule pull's own check, so two games with the same start never count as out of order.
  select not exists (
    select 1 from (select kickoff_at, lag(kickoff_at) over (order by order_index) as previous_kickoff from bowl_pool_games where season_id=game_row.season_id) listed
    where listed.previous_kickoff is not null and listed.kickoff_at + interval '1 minute' < listed.previous_kickoff
  ) into was_chronological;
  update bowl_pool_games
  set kickoff_at=new_kickoff_at,
      line_lock_at=least(new_kickoff_at, ((new_kickoff_at at time zone 'America/New_York')::date + time '08:00') at time zone 'America/New_York'),
      time_confirmed=true, status='scheduled', finalized_at=null
  where id=target_game_id returning * into game_row;
  if was_chronological then
    update bowl_pool_games moved
    set order_index=ranked.position
    from (select id, row_number() over (order by kickoff_at, order_index, id) as position from bowl_pool_games where season_id=game_row.season_id) ranked
    where moved.id=ranked.id and moved.order_index is distinct from ranked.position;
    select * into game_row from bowl_pool_games where id=target_game_id;
  end if;
  return game_row;
end; $$;
