-- One-time commissioner-requested correction: remove Zac's locked Patriots
-- Survivor selection for the 2026 season. The production identifiers are
-- resolved from canonical records; development databases without this player
-- safely no-op. More than one match is treated as an integrity failure.
do $$
declare
  matching_pick_count integer := 0;
  target_pick_id uuid;
  target_player_id uuid;
  target_period_id uuid;
  target_game_id uuid;
  target_team_id uuid;
  commissioner_player_id uuid;
begin
  select count(*)
    into matching_pick_count
  from public.survivor_picks pick
  join public.survivor_entries entry on entry.id = pick.survivor_entry_id
  join public.players player on player.id = entry.player_id
  join public.seasons season on season.id = entry.season_id
  join public.teams team on team.id = pick.selected_team_id
  join public.scoring_periods period on period.id = pick.scoring_period_id
  where lower(trim(player.first_name)) = 'zac'
    and season.year = 2026
    and period.status in ('active', 'upcoming')
    and pick.result = 'pending'
    and (upper(team.abbreviation) = 'NE' or lower(team.full_name) = 'new england patriots');

  if matching_pick_count > 1 then
    raise exception 'Refusing to clear Zac Survivor pick: found % matching Patriots picks', matching_pick_count;
  end if;

  if matching_pick_count = 1 then
    select pick.id, entry.player_id, pick.scoring_period_id, pick.game_id, pick.selected_team_id
      into target_pick_id, target_player_id, target_period_id, target_game_id, target_team_id
    from public.survivor_picks pick
    join public.survivor_entries entry on entry.id = pick.survivor_entry_id
    join public.players player on player.id = entry.player_id
    join public.seasons season on season.id = entry.season_id
    join public.teams team on team.id = pick.selected_team_id
    join public.scoring_periods period on period.id = pick.scoring_period_id
    where lower(trim(player.first_name)) = 'zac'
      and season.year = 2026
      and period.status in ('active', 'upcoming')
      and pick.result = 'pending'
      and (upper(team.abbreviation) = 'NE' or lower(team.full_name) = 'new england patriots');

    select id
      into commissioner_player_id
    from public.players
    where is_commissioner = true
    order by created_at
    limit 1;

    delete from public.survivor_picks where id = target_pick_id;

    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    values (
      commissioner_player_id,
      'survivor_pick_cleared_by_commissioner',
      'survivor_pick',
      target_pick_id,
      jsonb_build_object(
        'player_id', target_player_id,
        'scoring_period_id', target_period_id,
        'game_id', target_game_id,
        'selected_team_id', target_team_id,
        'reason', 'Commissioner-requested locked Patriots pick correction'
      )
    );
  end if;
end;
$$;
