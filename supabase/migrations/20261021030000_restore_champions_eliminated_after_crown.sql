-- One-time repair. Before 20261021020000 the no-pick rule eliminated a crowned Survivor champion in the following week (the champion makes no more picks).
-- A crowned champion stays an active entry, so each such entry is put back exactly as it was before the rule fired. The repair is deliberately narrow:
--   * the player holds a Survivor championship for that season,
--   * the entry was eliminated by the no-pick rule (no losing game), and an audit row from that rule says so,
--   * and it happened after the crown.
-- A genuine loss, or an elimination before the crown, is never touched. The integrity trigger is opened with its own audited score-correction guard,
-- for this statement only, and every restored entry is written to the audit log.
do $$
begin
  perform set_config('app.allow_survivor_score_correction', 'on', true);

  with restorable as (
    select entry.id as entry_id, entry.player_id, entry.season_id,
      entry.eliminated_scoring_period_id, entry.eliminated_at
    from public.survivor_entries entry
    join public.pool_championships championship
      on championship.season_id = entry.season_id and championship.player_id = entry.player_id and championship.pool = 'survivor'
    where entry.status = 'eliminated'
      and entry.eliminated_game_id is null
      and entry.eliminated_at > championship.crowned_at
      and exists (
        select 1 from public.audit_logs audit
        where audit.action = 'survivor_no_pick_eliminated' and audit.entity_type = 'survivor_entry' and audit.entity_id = entry.id
      )
  ), restored as (
    update public.survivor_entries entry
    set status = 'active', eliminated_scoring_period_id = null, eliminated_game_id = null, eliminated_at = null
    from restorable
    where entry.id = restorable.entry_id
    returning entry.id, entry.player_id, restorable.eliminated_scoring_period_id, restorable.eliminated_at as was_eliminated_at
  )
  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  select null, 'survivor_champion_entry_restored', 'survivor_entry', restored.id,
    jsonb_build_object('player_id', restored.player_id, 'scoring_period_id', restored.eliminated_scoring_period_id,
      'was_eliminated_at', restored.was_eliminated_at,
      'reason', 'A crowned Survivor champion was eliminated by the no-pick rule after the crown; the entry is restored.')
  from restored;

  perform set_config('app.allow_survivor_score_correction', 'off', true);
end;
$$;
