-- Qualify the player column and use a distinct local name. The previous
-- function declaration made `is_commissioner` ambiguous in Postgres.
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
  select id, first_kickoff_at into target_entry_id, first_kickoff from bowl_pool_entries where season_id = target_season_id and player_id = target_player_id for update;
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
    where p.id is not null and p.entry_id=target_entry_id and p.game_id=g.id and g.kickoff_at > evaluated_at
      and not exists (select 1 from jsonb_to_recordset(coalesce(target_selections,'[]'::jsonb)) as s(game_id uuid, team_id uuid) where s.game_id=p.game_id);
  for selection in select * from jsonb_to_recordset(coalesce(target_selections,'[]'::jsonb)) as s(game_id uuid, team_id uuid) loop
    insert into bowl_pool_picks(entry_id, game_id, selected_team_id, submitted_at, result)
      values(target_entry_id, selection.game_id, selection.team_id, evaluated_at, 'pending')
      on conflict(entry_id, game_id) do update set selected_team_id=excluded.selected_team_id, submitted_at=excluded.submitted_at;
  end loop;
  return target_entry_id;
end; $$;

revoke all on function public.save_bowl_pool_submission(uuid,uuid,boolean,jsonb,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.save_bowl_pool_submission(uuid,uuid,boolean,jsonb,integer,timestamptz) to service_role;
