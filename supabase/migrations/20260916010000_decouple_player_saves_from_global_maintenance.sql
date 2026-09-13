-- Player saves must never be held hostage by a pool-wide maintenance pass.
-- The scheduled workers still void every affected receipt, but a person saving
-- a pick only needs the disrupted receipts that belong to their own submission
-- to be reconciled.  Do that inside the same transaction as the replacement.

create or replace function public.replace_unlocked_picks(
  target_player_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_scoring_period_accepts_picks(target_scoring_period_id);

  with voided as (
    update public.picks p
    set result = 'void'
    from public.games g
    where p.player_id = target_player_id
      and p.scoring_period_id = target_scoring_period_id
      and p.game_id = g.id
      and p.result = 'pending'
      and g.status in ('postponed', 'cancelled', 'no_contest')
    returning p.id, p.player_id, p.game_id, g.status as game_status
  )
  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  select player_id, 'ats_pick_voided', 'pick', id,
    jsonb_build_object('scoring_mode', 'against_spread', 'game_id', game_id, 'reason', game_status)
  from voided;

  perform public.replace_unlocked_picks_unchecked_20260826(
    target_player_id,
    target_scoring_period_id,
    replacement_picks
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
set search_path = public
as $$
begin
  perform public.assert_scoring_period_accepts_picks(target_scoring_period_id);

  with voided as (
    update public.survivor_picks p
    set result = 'void'
    from public.games g
    where p.survivor_entry_id = target_survivor_entry_id
      and p.scoring_period_id = target_scoring_period_id
      and p.game_id = g.id
      and p.result = 'pending'
      and g.status in ('postponed', 'cancelled', 'no_contest')
    returning p.id, p.game_id, p.selected_team_id, g.status as game_status
  )
  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  select se.player_id, 'survivor_pick_voided', 'survivor_pick', voided.id,
    jsonb_build_object('scoring_mode', 'straight_up', 'spread_applied', false,
      'game_id', voided.game_id, 'selected_team_id', voided.selected_team_id,
      'reason', voided.game_status)
  from voided
  join public.survivor_entries se on se.id = target_survivor_entry_id;

  perform public.replace_unlocked_survivor_pick_unchecked_20260826(
    target_survivor_entry_id,
    target_scoring_period_id,
    replacement_pick
  );
end;
$$;

-- Pick'em can save ATS and Survivor together.  Keep that all-or-nothing, but
-- use the hardened replacement functions above rather than duplicating their
-- unlocked-pick rules here.
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

  perform public.replace_unlocked_picks(
    target_player_id,
    target_scoring_period_id,
    replacement_picks
  );
  perform public.replace_unlocked_survivor_pick(
    target_survivor_entry_id,
    target_scoring_period_id,
    replacement_survivor_pick
  );

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

revoke all on function public.replace_unlocked_picks(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.replace_unlocked_survivor_pick(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_unlocked_picks(uuid, uuid, jsonb) to service_role;
grant execute on function public.replace_unlocked_survivor_pick(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb) to service_role;
