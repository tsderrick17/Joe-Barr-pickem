-- Replaces the combined summary audit with exact, mode-specific records.
-- ATS is graded against the official spread; Survivor is always straight up.
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
  final_ats_selections jsonb;
  final_survivor_selection jsonb;
begin
  perform 1
  from public.survivor_entries
  where id = target_survivor_entry_id
    and player_id = target_player_id;

  if not found then
    raise exception 'The Survivor entry does not belong to this player.';
  end if;

  delete from public.picks
  using public.games
  where picks.player_id = target_player_id
    and picks.scoring_period_id = target_scoring_period_id
    and games.id = picks.game_id
    and games.kickoff_at > now();

  insert into public.picks (player_id, scoring_period_id, game_id, selected_team_id)
  select
    target_player_id,
    target_scoring_period_id,
    (replacement_pick ->> 'game_id')::uuid,
    (replacement_pick ->> 'selected_team_id')::uuid
  from jsonb_array_elements(replacement_picks) as replacement_pick;

  delete from public.survivor_picks
  using public.games
  where survivor_picks.survivor_entry_id = target_survivor_entry_id
    and survivor_picks.scoring_period_id = target_scoring_period_id
    and games.id = survivor_picks.game_id
    and games.kickoff_at > now();

  if replacement_survivor_pick is not null then
    insert into public.survivor_picks (
      survivor_entry_id, scoring_period_id, game_id, selected_team_id
    ) values (
      target_survivor_entry_id,
      target_scoring_period_id,
      (replacement_survivor_pick ->> 'game_id')::uuid,
      (replacement_survivor_pick ->> 'selected_team_id')::uuid
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'game_id', picks.game_id,
        'selected_team_id', picks.selected_team_id
      ) order by picks.submitted_at, picks.id
    ),
    '[]'::jsonb
  )
  into final_ats_selections
  from public.picks
  where player_id = target_player_id
    and scoring_period_id = target_scoring_period_id;

  select jsonb_build_object(
    'game_id', survivor_picks.game_id,
    'selected_team_id', survivor_picks.selected_team_id
  )
  into final_survivor_selection
  from public.survivor_picks
  where survivor_entry_id = target_survivor_entry_id
    and scoring_period_id = target_scoring_period_id;

  insert into public.audit_logs (
    actor_player_id, action, entity_type, entity_id, details
  ) values (
    target_player_id,
    'ats_picks_saved',
    'scoring_period',
    target_scoring_period_id,
    jsonb_build_object(
      'scoring_mode', 'against_spread',
      'selections', final_ats_selections
    )
  );

  insert into public.audit_logs (
    actor_player_id, action, entity_type, entity_id, details
  ) values (
    target_player_id,
    case when final_survivor_selection is null
      then 'survivor_pick_cleared'
      else 'survivor_pick_saved'
    end,
    'scoring_period',
    target_scoring_period_id,
    jsonb_build_object(
      'scoring_mode', 'straight_up',
      'spread_applied', false,
      'selection', final_survivor_selection
    )
  );
end;
$$;
