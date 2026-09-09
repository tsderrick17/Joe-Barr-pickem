create index if not exists bowl_pool_picks_entry_result_idx on public.bowl_pool_picks(entry_id, result);
create index if not exists bowl_pool_picks_game_result_idx on public.bowl_pool_picks(game_id, result);
create index if not exists bowl_pool_game_results_entry_game_idx on public.bowl_pool_game_results(entry_id, game_id);
create index if not exists bowl_pool_entries_season_status_idx on public.bowl_pool_entries(season_id, status);
create index if not exists push_reminders_bowl_source_games_idx on public.push_reminders using gin(source_game_ids) where category in ('bowl_pick_due', 'bowl_daily_recap');
