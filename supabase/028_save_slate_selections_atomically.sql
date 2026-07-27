-- Saves the ATS slate and optional Survivor selection in one transaction.
-- Any validation failure rolls back every deletion, insertion, and audit entry.
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

  insert into public.audit_logs (
    actor_player_id, action, entity_type, entity_id, details
  ) values (
    target_player_id,
    'slate_selections_saved',
    'scoring_period',
    target_scoring_period_id,
    jsonb_build_object(
      'ats_pick_count', jsonb_array_length(replacement_picks),
      'survivor_pick_saved', replacement_survivor_pick is not null
    )
  );
end;
$$;
