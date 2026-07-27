-- A revision must remove every editable pick before validating replacement
-- selections. Otherwise the row-level maximum-pick trigger can count stale
-- selections and reject a valid change from two picks to one.
create or replace function public.replace_unlocked_picks(
  target_player_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb
)
returns void
language plpgsql
as $$
begin
  delete from public.picks as existing_pick
  using public.games as existing_game
  where existing_pick.player_id = target_player_id
    and existing_pick.scoring_period_id = target_scoring_period_id
    and existing_game.id = existing_pick.game_id
    and existing_game.kickoff_at > statement_timestamp();

  insert into public.picks (
    player_id,
    scoring_period_id,
    game_id,
    selected_team_id
  )
  select
    target_player_id,
    target_scoring_period_id,
    (replacement_pick ->> 'game_id')::uuid,
    (replacement_pick ->> 'selected_team_id')::uuid
  from jsonb_array_elements(replacement_picks) as replacement_pick;
end;
$$;
