-- Postponed and cancelled Bowl games keep their picks, and a postponed game can be rescheduled.
--
-- The matchup freeze (protect_bowl_game_identity) refuses a kickoff change on any game with picks or a locked line, and
-- reschedule_bowl_game moves the kickoff, so the Commissioner's "Reschedule" failed for exactly the games it exists for: a
-- postponed game always has picks. The freeze now lets the postponed-to-scheduled step through, and only that step; teams stay
-- frozen, and a confirmed kickoff on any other game stays frozen.
create or replace function public.protect_bowl_game_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.away_team_id is distinct from new.away_team_id or old.home_team_id is distinct from new.home_team_id
      or (old.kickoff_at is distinct from new.kickoff_at and old.time_confirmed
          and not (old.status = 'postponed' and new.status = 'scheduled')))
     and (exists (select 1 from bowl_pool_picks where game_id=old.id)
          or exists (select 1 from bowl_pool_game_lines where game_id=old.id and locked_at is not null)) then
    raise exception 'A Bowl Pool matchup with picks or a locked line cannot be replaced.';
  end if;
  return new;
end; $$;

-- The new kickoff is the Commissioner's, so it counts as confirmed, and the line locks at 8 AM Eastern on the new game day like
-- every other Bowl game (it used to lock at kickoff, which left the day's lines unofficial until the game began). A line already
-- locked stays as it was.
create or replace function public.reschedule_bowl_game(target_game_id uuid, new_kickoff_at timestamptz, actor_player_id uuid)
returns public.bowl_pool_games language plpgsql security definer set search_path = public as $$
declare game_row public.bowl_pool_games%rowtype;
begin
  if not exists (select 1 from players where id=actor_player_id and is_commissioner=true and active=true) then raise exception 'Commissioner access is required.'; end if;
  select * into game_row from bowl_pool_games where id=target_game_id for update;
  if game_row.id is null then raise exception 'Bowl Pool game was not found.'; end if;
  if game_row.status <> 'postponed' then raise exception 'Only postponed Bowl games can be rescheduled.'; end if;
  if new_kickoff_at <= clock_timestamp() then raise exception 'The new Bowl kickoff must be in the future.'; end if;
  update bowl_pool_games
  set kickoff_at=new_kickoff_at,
      line_lock_at=least(new_kickoff_at, ((new_kickoff_at at time zone 'America/New_York')::date + time '08:00') at time zone 'America/New_York'),
      time_confirmed=true, status='scheduled', finalized_at=null
  where id=target_game_id returning * into game_row;
  return game_row;
end; $$;

-- A player's Submit sends the games still open and omits the rest, and the function deletes the picks it was not given for games that have
-- not kicked off. A postponed or cancelled game has a future kickoff but is not open, so omitting it erased the player's pick on it (a
-- cancelled game's pick is a voided one the player should keep seeing). Only a game still open for selection can lose a pick this way.
create or replace function public.save_bowl_pool_submission(
  target_player_id uuid,
  target_season_id uuid,
  target_opted_in boolean,
  target_selections jsonb,
  target_tiebreaker integer,
  evaluated_at timestamptz default clock_timestamp()
) returns uuid language plpgsql security definer set search_path = public as $$
declare target_entry_id uuid; first_kickoff timestamptz; selection record; viewer_is_commissioner boolean;
begin
  select coalesce(p.is_commissioner, false) into viewer_is_commissioner from public.players p where p.id = target_player_id;
  select s.first_kickoff_at into first_kickoff from public.bowl_pool_seasons s where s.id = target_season_id;
  select e.id into target_entry_id from public.bowl_pool_entries e where e.season_id = target_season_id and e.player_id = target_player_id for update;
  if not target_opted_in then
    if first_kickoff is not null and evaluated_at >= first_kickoff and not viewer_is_commissioner then raise exception 'Bowl Pool opt-out closed at the first kickoff.'; end if;
    if target_entry_id is not null then update bowl_pool_entries set status='withdrawn', opted_out_at=evaluated_at where id=target_entry_id; end if;
    return target_entry_id;
  end if;
  if first_kickoff is not null and evaluated_at >= first_kickoff and not viewer_is_commissioner and (target_entry_id is null or not exists (select 1 from bowl_pool_entries where id=target_entry_id and status in ('active','complete'))) then raise exception 'Bowl Pool entry closed at the first kickoff.'; end if;
  if target_entry_id is null then
    insert into bowl_pool_entries(season_id, player_id, status, opted_in_at, championship_total_guess) values(target_season_id, target_player_id, 'active', evaluated_at, target_tiebreaker) returning id into target_entry_id;
  else
    update bowl_pool_entries set status='active', opted_out_at=null, championship_total_guess=target_tiebreaker where id=target_entry_id;
  end if;
  delete from bowl_pool_picks p using bowl_pool_games g
    where p.id is not null and p.entry_id=target_entry_id and p.game_id=g.id and g.kickoff_at > evaluated_at and g.status = 'scheduled'
      and not exists (select 1 from jsonb_to_recordset(coalesce(target_selections,'[]'::jsonb)) as s(game_id uuid, team_id uuid) where s.game_id=p.game_id);
  for selection in select * from jsonb_to_recordset(coalesce(target_selections,'[]'::jsonb)) as s(game_id uuid, team_id uuid) loop
    insert into bowl_pool_picks(entry_id, game_id, selected_team_id, submitted_at, result)
      values(target_entry_id, selection.game_id, selection.team_id, evaluated_at, 'pending')
      on conflict(entry_id, game_id) do update set selected_team_id=excluded.selected_team_id, submitted_at=excluded.submitted_at;
  end loop;
  return target_entry_id;
end; $$;
