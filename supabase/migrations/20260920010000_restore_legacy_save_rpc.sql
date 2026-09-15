-- The receipt-aware save experiment was removed from the release. Restore the
-- proven five-argument RPC for databases that already applied that experiment.
create or replace function public.save_slate_selections(
  target_player_id uuid,
  target_survivor_entry_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb,
  replacement_survivor_pick jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform 1
  from public.survivor_entries
  where id = target_survivor_entry_id
    and player_id = target_player_id;
  if not found then
    raise exception 'The Survivor entry does not belong to this player.';
  end if;

  perform public.replace_unlocked_picks(target_player_id, target_scoring_period_id, replacement_picks);
  perform public.replace_unlocked_survivor_pick(target_survivor_entry_id, target_scoring_period_id, replacement_survivor_pick);

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (
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

revoke all on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb) to service_role;
