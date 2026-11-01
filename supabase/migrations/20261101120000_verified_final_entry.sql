-- Last resort for an NFL final the score provider can no longer supply (audit REL-7, owner decision D5).
-- The Odds API scores endpoint reaches back three days. A game still not final after that window can have
-- a verified final entered by the Commissioner. It goes through the same atomic grading function as the
-- automatic path (finalize_games_atomically), so ATS, Survivor and playoff rules are identical, and it
-- writes an audit row in the same transaction. It never replaces a final that already exists: a wrong
-- final still goes through correct_final_game_score_atomically.
create or replace function public.record_verified_final(
  target_game_id uuid,
  verified_away_score integer,
  verified_home_score integer,
  verification_source text,
  actor_player_id uuid default null
)
returns table(final_scores_imported integer, ats_picks_graded integer, survivor_picks_graded integer)
language plpgsql security definer set search_path = public as $$
declare
  game_row public.games%rowtype;
  source_text text := nullif(btrim(verification_source), '');
  imported record;
begin
  if source_text is null then
    raise exception 'Say where the final score was verified.';
  end if;
  if char_length(source_text) > 200 then
    raise exception 'The verification note is too long.';
  end if;
  if verified_away_score is null or verified_home_score is null
    or verified_away_score < 0 or verified_home_score < 0 then
    raise exception 'Both final scores are required and cannot be negative.';
  end if;

  select * into game_row from public.games where id = target_game_id for update;
  if not found then
    raise exception 'That game was not found.';
  end if;
  if game_row.status = 'final' then
    raise exception 'That game already has a final score. A wrong final goes through the audited correction workflow.';
  end if;
  if game_row.status in ('postponed', 'cancelled', 'no_contest') then
    raise exception 'A postponed, cancelled, or no-contest game has no final score to enter.';
  end if;
  if game_row.kickoff_at > clock_timestamp() - interval '3 days' then
    raise exception 'A final can be entered by hand only after the score provider''s three-day window has passed.';
  end if;

  select * into imported from public.finalize_games_atomically(
    jsonb_build_array(jsonb_build_object(
      'game_id', target_game_id,
      'away_score', verified_away_score,
      'home_score', verified_home_score
    )),
    clock_timestamp()
  );
  if imported.final_scores_imported is distinct from 1 then
    raise exception 'The final score could not be saved safely.';
  end if;

  delete from public.score_check_backoff where game_id = target_game_id;

  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  values (actor_player_id, 'final_score_entered_manually', 'game', target_game_id,
    jsonb_build_object('away_score', verified_away_score, 'home_score', verified_home_score,
      'verified_by', source_text, 'kickoff_at', game_row.kickoff_at,
      'ats_graded', imported.ats_picks_graded, 'survivor_graded', imported.survivor_picks_graded));

  return query select imported.final_scores_imported, imported.ats_picks_graded, imported.survivor_picks_graded;
end;
$$;

revoke all on function public.record_verified_final(uuid, integer, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.record_verified_final(uuid, integer, integer, text, uuid) to service_role;
