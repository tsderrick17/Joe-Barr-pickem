-- Keeps the player-facing pages and scheduled jobs responsive as the season
-- accumulates picks, score audits, and line-history snapshots.
create index if not exists picks_scoring_period_id_idx
  on public.picks (scoring_period_id);

create index if not exists picks_player_result_idx
  on public.picks (player_id, result);

create index if not exists games_scoring_period_kickoff_idx
  on public.games (scoring_period_id, kickoff_at);

create index if not exists games_status_kickoff_idx
  on public.games (status, kickoff_at);

create index if not exists games_status_line_lock_kickoff_idx
  on public.games (status, line_lock_at, kickoff_at);

create index if not exists spread_history_game_captured_idx
  on public.spread_history (game_id, captured_at desc);

create index if not exists audit_logs_final_score_idx
  on public.audit_logs (action, entity_type, entity_id, created_at desc);

create index if not exists sync_runs_job_started_idx
  on public.sync_runs (job_type, started_at desc);
