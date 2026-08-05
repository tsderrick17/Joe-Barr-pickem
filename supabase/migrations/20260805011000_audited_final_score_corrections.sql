-- An official provider can correct a posted final. Regrade only through this
-- audited path; normal score import remains append-only once a game is final.
create or replace function public.correct_final_game_score_atomically(
  target_game_id uuid,
  corrected_away_score integer,
  corrected_home_score integer,
  actor_player_id uuid default null
)
returns table(
  scoring_period_id uuid,
  ats_results_changed integer,
  survivor_results_changed integer
)
language plpgsql security definer set search_path = public as $$
declare
  game_row public.games%rowtype;
  line_row public.game_lines%rowtype;
  prior_away integer;
  prior_home integer;
  ats_changed integer := 0;
  survivor_changed integer := 0;
  commissioner_id uuid;
  period_name text;
begin
  if corrected_away_score < 0 or corrected_home_score < 0 then
    raise exception 'Final scores cannot be negative.';
  end if;

  select * into game_row from public.games where id = target_game_id for update;
  if not found or game_row.status <> 'final' then
    raise exception 'Only an already-final game can be corrected.';
  end if;

  select * into line_row from public.game_lines where game_id = target_game_id;
  if not found then
    raise exception 'A corrected final requires its retained official line.';
  end if;

  prior_away := game_row.away_score;
  prior_home := game_row.home_score;
  select display_name into period_name from public.scoring_periods where id = game_row.scoring_period_id;

  update public.games
  set away_score = corrected_away_score, home_score = corrected_home_score
  where id = target_game_id;

  with regraded as (
    update public.picks p
    set result = case
      when p.result = 'void' then 'void'
      when p.selected_team_id = line_row.favorite_team_id then
        case when (case when line_row.favorite_team_id = game_row.away_team_id
          then corrected_away_score - corrected_home_score
          else corrected_home_score - corrected_away_score end) > line_row.locked_spread then 'win' else 'loss' end
      else
        case when (case when line_row.favorite_team_id = game_row.away_team_id
          then corrected_away_score - corrected_home_score
          else corrected_home_score - corrected_away_score end) < line_row.locked_spread then 'win' else 'loss' end
    end
    where p.game_id = target_game_id
    returning p.id, p.result
  ) select count(*) into ats_changed from regraded;

  with regraded as (
    update public.survivor_picks sp
    set result = case
      when sp.result = 'void' then 'void'
      when corrected_away_score = corrected_home_score then 'loss'
      when (corrected_away_score > corrected_home_score and sp.selected_team_id = game_row.away_team_id)
        or (corrected_home_score > corrected_away_score and sp.selected_team_id = game_row.home_team_id) then 'win'
      else 'loss'
    end
    where sp.game_id = target_game_id
    returning sp.survivor_entry_id
  ) select count(*) into survivor_changed from regraded;

  -- Rebuild affected Survivor entry state from its authoritative pick history.
  perform set_config('app.allow_survivor_score_correction', 'on', true);
  with desired as (
    select entry.id,
      loss_pick.scoring_period_id as loss_period_id,
      loss_pick.game_id as loss_game_id,
      loss_game.kickoff_at as loss_at
    from public.survivor_entries entry
    left join lateral (
      select sp.scoring_period_id, sp.game_id
      from public.survivor_picks sp
      join public.scoring_periods sp_period on sp_period.id = sp.scoring_period_id
      where sp.survivor_entry_id = entry.id and sp.result = 'loss' and sp_period.season_id = entry.season_id
      order by sp_period.display_order, sp.submitted_at
      limit 1
    ) loss_pick on true
    left join public.games loss_game on loss_game.id = loss_pick.game_id
    where entry.season_id = (select season_id from public.scoring_periods where id = game_row.scoring_period_id)
      and entry.status <> 'complete'
  )
  update public.survivor_entries entry
  set status = case when desired.loss_game_id is null then 'active' else 'eliminated' end,
    eliminated_scoring_period_id = desired.loss_period_id,
    eliminated_game_id = desired.loss_game_id,
    eliminated_at = case when desired.loss_game_id is null then null else coalesce(desired.loss_at, clock_timestamp()) end
  from desired where desired.id = entry.id;

  insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
  values (actor_player_id, 'final_score_corrected', 'game', target_game_id,
    jsonb_build_object('prior_away_score', prior_away, 'prior_home_score', prior_home,
      'corrected_away_score', corrected_away_score, 'corrected_home_score', corrected_home_score,
      'ats_regraded', ats_changed, 'survivor_regraded', survivor_changed));

  select id into commissioner_id from public.players where is_commissioner = true order by created_at limit 1;
  if commissioner_id is not null then
    insert into public.pool_chat_messages(season_id, player_id, body, is_moderator)
    select sp.season_id, commissioner_id,
      format('Scoring correction — %s: final score updated. ATS and Survivor results were automatically regraded; affected standings were refreshed.', coalesce(period_name, 'This week')),
      true
    from public.scoring_periods sp where sp.id = game_row.scoring_period_id;
  end if;

  return query select game_row.scoring_period_id, ats_changed, survivor_changed;
end;
$$;

revoke all on function public.correct_final_game_score_atomically(uuid, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.correct_final_game_score_atomically(uuid, integer, integer, uuid) to service_role;
