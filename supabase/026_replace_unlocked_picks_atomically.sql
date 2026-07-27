-- Replaces a player's unlocked picks as one transaction. If any replacement
-- fails validation, PostgreSQL rolls the deletion back as well.
create or replace function public.replace_unlocked_picks(
  target_player_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb
)
returns void
language plpgsql
as $$
begin
  delete from public.picks
  using public.games
  where picks.player_id = target_player_id
    and picks.scoring_period_id = target_scoring_period_id
    and games.id = picks.game_id
    and games.kickoff_at > now();

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
