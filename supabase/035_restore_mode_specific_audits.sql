-- Restore the mode-specific, append-only audit trail after the emergency ATS
-- replacement repair. Also use the wall clock (not transaction start time) at
-- kickoff so a pick cannot slip through in the first milliseconds after start.

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
  if clock_timestamp() >= game_kickoff_at then raise exception 'That game has already started.'; end if;

  select max_picks into allowed_pick_count from public.scoring_periods where id = new.scoring_period_id;
  select count(*) into existing_pick_count from public.picks where player_id = new.player_id and scoring_period_id = new.scoring_period_id and id is distinct from new.id;
  if existing_pick_count >= allowed_pick_count then raise exception 'This player already has the maximum number of picks for the week.'; end if;
  return new;
end;
$$;

create or replace function public.validate_survivor_pick()
returns trigger
language plpgsql
as $$
declare
  game_period_id uuid;
  game_away_team_id uuid;
  game_home_team_id uuid;
  game_kickoff_at timestamptz;
  entry_season_id uuid;
  entry_status text;
  period_season_id uuid;
begin
  select scoring_period_id, away_team_id, home_team_id, kickoff_at
  into game_period_id, game_away_team_id, game_home_team_id, game_kickoff_at
  from public.games
  where id = new.game_id;

  if game_period_id is null or new.scoring_period_id is distinct from game_period_id then
    raise exception 'A Survivor pick must belong to the selected game''s week.';
  end if;
  if new.selected_team_id not in (game_away_team_id, game_home_team_id) then
    raise exception 'A Survivor pick must select one of the two teams in that game.';
  end if;
  if clock_timestamp() >= game_kickoff_at then
    raise exception 'That Survivor game has already started.';
  end if;

  select season_id, status into entry_season_id, entry_status
  from public.survivor_entries where id = new.survivor_entry_id;
  select season_id into period_season_id from public.scoring_periods where id = new.scoring_period_id;

  if entry_season_id is null or entry_season_id is distinct from period_season_id then
    raise exception 'The Survivor entry does not belong to this season.';
  end if;
  if entry_status is distinct from 'active' then
    raise exception 'This Survivor entry is no longer active.';
  end if;
  return new;
end;
$$;

create or replace function public.replace_unlocked_picks(
  target_player_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb
)
returns void
language plpgsql
as $$
declare
  final_ats_selections jsonb;
begin
  delete from public.picks as existing_pick
  where existing_pick.player_id = target_player_id
    and existing_pick.scoring_period_id = target_scoring_period_id
    and exists (
      select 1 from public.games as existing_game
      where existing_game.id = existing_pick.game_id
        and existing_game.kickoff_at > clock_timestamp()
    );

  insert into public.picks (player_id, scoring_period_id, game_id, selected_team_id)
  select target_player_id, target_scoring_period_id,
    (replacement_pick ->> 'game_id')::uuid,
    (replacement_pick ->> 'selected_team_id')::uuid
  from jsonb_array_elements(replacement_picks) as replacement_pick;

  select coalesce(
    jsonb_agg(jsonb_build_object('game_id', game_id, 'selected_team_id', selected_team_id) order by submitted_at, id),
    '[]'::jsonb
  ) into final_ats_selections
  from public.picks
  where player_id = target_player_id and scoring_period_id = target_scoring_period_id;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (
    target_player_id, 'ats_picks_saved', 'scoring_period', target_scoring_period_id,
    jsonb_build_object('scoring_mode', 'against_spread', 'selections', final_ats_selections)
  );
end;
$$;

create or replace function public.replace_unlocked_survivor_pick(
  target_survivor_entry_id uuid,
  target_scoring_period_id uuid,
  replacement_pick jsonb
)
returns void
language plpgsql
as $$
declare
  entry_player_id uuid;
  final_survivor_selection jsonb;
begin
  select player_id into entry_player_id from public.survivor_entries where id = target_survivor_entry_id;
  if entry_player_id is null then raise exception 'The Survivor entry could not be found.'; end if;

  delete from public.survivor_picks
  using public.games
  where survivor_picks.survivor_entry_id = target_survivor_entry_id
    and survivor_picks.scoring_period_id = target_scoring_period_id
    and games.id = survivor_picks.game_id
    and games.kickoff_at > clock_timestamp();

  if replacement_pick is not null then
    insert into public.survivor_picks (survivor_entry_id, scoring_period_id, game_id, selected_team_id)
    values (target_survivor_entry_id, target_scoring_period_id,
      (replacement_pick ->> 'game_id')::uuid,
      (replacement_pick ->> 'selected_team_id')::uuid);
  end if;

  select jsonb_build_object('game_id', game_id, 'selected_team_id', selected_team_id)
  into final_survivor_selection
  from public.survivor_picks
  where survivor_entry_id = target_survivor_entry_id and scoring_period_id = target_scoring_period_id;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (
    entry_player_id,
    case when final_survivor_selection is null then 'survivor_pick_cleared' else 'survivor_pick_saved' end,
    'scoring_period', target_scoring_period_id,
    jsonb_build_object('scoring_mode', 'straight_up', 'spread_applied', false, 'selection', final_survivor_selection)
  );
end;
$$;

create or replace function public.save_slate_selections(
  target_player_id uuid,
  target_survivor_entry_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb,
  replacement_survivor_pick jsonb
)
returns void
language plpgsql
as $$
declare
  final_survivor_selection jsonb;
begin
  perform 1 from public.survivor_entries
  where id = target_survivor_entry_id and player_id = target_player_id;
  if not found then raise exception 'The Survivor entry does not belong to this player.'; end if;

  perform public.replace_unlocked_picks(
    target_player_id, target_scoring_period_id, replacement_picks
  );

  delete from public.survivor_picks
  using public.games
  where survivor_picks.survivor_entry_id = target_survivor_entry_id
    and survivor_picks.scoring_period_id = target_scoring_period_id
    and games.id = survivor_picks.game_id
    and games.kickoff_at > clock_timestamp();

  if replacement_survivor_pick is not null then
    insert into public.survivor_picks (survivor_entry_id, scoring_period_id, game_id, selected_team_id)
    values (target_survivor_entry_id, target_scoring_period_id,
      (replacement_survivor_pick ->> 'game_id')::uuid,
      (replacement_survivor_pick ->> 'selected_team_id')::uuid);
  end if;

  select jsonb_build_object('game_id', game_id, 'selected_team_id', selected_team_id)
  into final_survivor_selection
  from public.survivor_picks
  where survivor_entry_id = target_survivor_entry_id and scoring_period_id = target_scoring_period_id;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (
    target_player_id,
    case when final_survivor_selection is null then 'survivor_pick_cleared' else 'survivor_pick_saved' end,
    'scoring_period', target_scoring_period_id,
    jsonb_build_object('scoring_mode', 'straight_up', 'spread_applied', false, 'selection', final_survivor_selection)
  );
end;
$$;
