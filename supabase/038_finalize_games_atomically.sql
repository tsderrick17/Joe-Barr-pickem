-- Accept final scores, grade ATS and Survivor, eliminate losing Survivor
-- entries, and append audit receipts as one transaction.
create or replace function public.finalize_games_atomically(
  final_games jsonb,
  accepted_at timestamptz default clock_timestamp()
)
returns table(final_scores_imported integer, ats_picks_graded integer, survivor_picks_graded integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  target_game public.games%rowtype;
  locked_line public.game_lines%rowtype;
  survivor_result text;
  updated_count integer;
  ats_count integer := 0;
  survivor_count integer := 0;
  game_count integer := 0;
  favorite_margin integer;
begin
  for item in select value from jsonb_array_elements(final_games) loop
    select * into target_game from public.games
    where id = (item ->> 'game_id')::uuid
    for update;

    if not found then raise exception 'A final score referenced an unknown game.'; end if;
    if target_game.status in ('postponed', 'cancelled') then raise exception 'A postponed or cancelled game cannot be finalized automatically.'; end if;

    update public.games set status = 'final', away_score = (item ->> 'away_score')::integer,
      home_score = (item ->> 'home_score')::integer, finalized_at = accepted_at
    where id = target_game.id;
    target_game.away_score := (item ->> 'away_score')::integer;
    target_game.home_score := (item ->> 'home_score')::integer;
    game_count := game_count + 1;

    select * into locked_line from public.game_lines where game_id = target_game.id;
    if found then
      favorite_margin := case when locked_line.favorite_team_id = target_game.away_team_id
        then target_game.away_score - target_game.home_score
        else target_game.home_score - target_game.away_score end;
      update public.picks p set result = case
        when p.selected_team_id = locked_line.favorite_team_id and favorite_margin > locked_line.locked_spread then 'win'
        when p.selected_team_id <> locked_line.favorite_team_id and favorite_margin < locked_line.locked_spread then 'win'
        else 'loss' end
      where p.game_id = target_game.id and p.result = 'pending';
      get diagnostics updated_count = row_count;
      ats_count := ats_count + updated_count;
    end if;

    for survivor_result in select id::text from public.survivor_picks where game_id = target_game.id and result = 'pending' loop
      update public.survivor_picks sp set result = case
        when sp.selected_team_id = target_game.away_team_id and target_game.away_score > target_game.home_score then 'win'
        when sp.selected_team_id = target_game.home_team_id and target_game.home_score > target_game.away_score then 'win'
        else 'loss' end
      where sp.id::text = survivor_result;
      survivor_count := survivor_count + 1;
    end loop;

    update public.survivor_entries se set status = 'eliminated', eliminated_scoring_period_id = target_game.scoring_period_id,
      eliminated_game_id = target_game.id, eliminated_at = accepted_at
    from public.survivor_picks sp
    where sp.survivor_entry_id = se.id and sp.game_id = target_game.id and sp.result = 'loss' and se.status = 'active';

    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    values (null, 'final_score_imported', 'game', target_game.id,
      jsonb_build_object('away_score', target_game.away_score, 'home_score', target_game.home_score));
  end loop;

  return query select game_count, ats_count, survivor_count;
end;
$$;
