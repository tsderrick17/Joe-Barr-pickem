-- Emergency production repair for the Week 1 ATS rehearsal.
-- Reapply the intended ATS integrity trigger and atomic save routines.

create or replace function public.validate_pick()
returns trigger
language plpgsql
as $$
declare
  game_period_id uuid;
  game_away_team_id uuid;
  game_home_team_id uuid;
  game_kickoff_at timestamptz;
  allowed_pick_count integer;
  existing_pick_count integer;
begin
  select scoring_period_id, away_team_id, home_team_id, kickoff_at
  into game_period_id, game_away_team_id, game_home_team_id, game_kickoff_at
  from public.games
  where id = new.game_id;

  if game_period_id is null then raise exception 'The selected game does not exist.'; end if;
  if new.scoring_period_id is distinct from game_period_id then raise exception 'A pick must belong to the game''s assigned week.'; end if;
  if new.selected_team_id not in (game_away_team_id, game_home_team_id) then raise exception 'A pick must select one of the two teams in that game.'; end if;
  if now() >= game_kickoff_at then raise exception 'That game has already started.'; end if;

  select max_picks into allowed_pick_count from public.scoring_periods where id = new.scoring_period_id;
  select count(*) into existing_pick_count from public.picks where player_id = new.player_id and scoring_period_id = new.scoring_period_id and id is distinct from new.id;
  if existing_pick_count >= allowed_pick_count then raise exception 'This player already has the maximum number of picks for the week.'; end if;
  return new;
end;
$$;

create or replace function public.replace_unlocked_picks(target_player_id uuid, target_scoring_period_id uuid, replacement_picks jsonb)
returns void
language plpgsql
as $$
begin
  delete from public.picks as existing_pick
  where existing_pick.player_id = target_player_id
    and existing_pick.scoring_period_id = target_scoring_period_id
    and exists (
      select 1
      from public.games as existing_game
      where existing_game.id = existing_pick.game_id
        and existing_game.kickoff_at > clock_timestamp()
    );

  insert into public.picks (player_id, scoring_period_id, game_id, selected_team_id)
  select target_player_id, target_scoring_period_id, (replacement_pick ->> 'game_id')::uuid, (replacement_pick ->> 'selected_team_id')::uuid
  from jsonb_array_elements(replacement_picks) as replacement_pick;
end;
$$;

create or replace function public.save_slate_selections(target_player_id uuid, target_survivor_entry_id uuid, target_scoring_period_id uuid, replacement_picks jsonb, replacement_survivor_pick jsonb)
returns void
language plpgsql
as $$
begin
  perform 1 from public.survivor_entries where id = target_survivor_entry_id and player_id = target_player_id;
  if not found then raise exception 'The Survivor entry does not belong to this player.'; end if;

  perform public.replace_unlocked_picks(target_player_id, target_scoring_period_id, replacement_picks);

  delete from public.survivor_picks
  using public.games
  where survivor_picks.survivor_entry_id = target_survivor_entry_id
    and survivor_picks.scoring_period_id = target_scoring_period_id
    and games.id = survivor_picks.game_id
    and games.kickoff_at > now();

  if replacement_survivor_pick is not null then
    insert into public.survivor_picks (survivor_entry_id, scoring_period_id, game_id, selected_team_id)
    values (target_survivor_entry_id, target_scoring_period_id, (replacement_survivor_pick ->> 'game_id')::uuid, (replacement_survivor_pick ->> 'selected_team_id')::uuid);
  end if;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (target_player_id, 'slate_selections_saved', 'scoring_period', target_scoring_period_id, jsonb_build_object('ats_pick_count', jsonb_array_length(replacement_picks), 'survivor_pick_saved', replacement_survivor_pick is not null));
end;
$$;
