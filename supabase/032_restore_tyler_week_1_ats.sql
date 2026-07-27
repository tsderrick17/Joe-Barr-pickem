-- Run only after 031_repair_ats_atomic_replacements.sql succeeds.
-- Restores the exact two original unlocked Week 1 ATS picks for the one active Tyler.
do $$
declare
  target_player_id uuid;
  target_period_id uuid;
  cincinnati_team_id uuid;
  san_francisco_team_id uuid;
  cincinnati_game_id uuid;
  san_francisco_game_id uuid;
begin
  select id into strict target_player_id from public.players where first_name = 'Tyler' and active = true;
  select id into strict target_period_id from public.scoring_periods where display_name = 'Week 1' and season_id = (select id from public.seasons where year = 2026);
  select id into strict cincinnati_team_id from public.teams where abbreviation = 'CIN';
  select id into strict san_francisco_team_id from public.teams where abbreviation = 'SF';
  select id into strict cincinnati_game_id from public.games where scoring_period_id = target_period_id and cincinnati_team_id in (away_team_id, home_team_id);
  select id into strict san_francisco_game_id from public.games where scoring_period_id = target_period_id and san_francisco_team_id in (away_team_id, home_team_id);

  perform public.replace_unlocked_picks(target_player_id, target_period_id, jsonb_build_array(
    jsonb_build_object('game_id', cincinnati_game_id, 'selected_team_id', cincinnati_team_id),
    jsonb_build_object('game_id', san_francisco_game_id, 'selected_team_id', san_francisco_team_id)
  ));
end;
$$;
