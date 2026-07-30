-- Keep every mutation that can affect scoring, Survivor status, or automation
-- ownership behind the server-side service role. PostgreSQL grants EXECUTE on
-- new functions to PUBLIC by default, including SECURITY DEFINER functions.

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
  submitted_away_score integer;
  submitted_home_score integer;
begin
  if jsonb_typeof(final_games) is distinct from 'array' then
    raise exception 'Final scores must be submitted as an array.';
  end if;

  if accepted_at is null or accepted_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The final-score acceptance time is invalid.';
  end if;

  for item in select value from jsonb_array_elements(final_games) loop
    begin
      submitted_away_score := (item ->> 'away_score')::integer;
      submitted_home_score := (item ->> 'home_score')::integer;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'A final score was not a valid whole number.';
    end;

    if submitted_away_score is null or submitted_home_score is null then
      raise exception 'Both final scores are required.';
    end if;
    if submitted_away_score < 0 or submitted_home_score < 0 then
      raise exception 'Final scores cannot be negative.';
    end if;

    select * into target_game
    from public.games
    where id = (item ->> 'game_id')::uuid
    for update;

    if not found then
      raise exception 'A final score referenced an unknown game.';
    end if;
    if target_game.status in ('postponed', 'cancelled') then
      raise exception 'A postponed or cancelled game cannot be finalized automatically.';
    end if;
    if target_game.kickoff_at > accepted_at then
      raise exception 'A game cannot be finalized before kickoff.';
    end if;
    if target_game.status = 'final' then
      if target_game.away_score = submitted_away_score
        and target_game.home_score = submitted_home_score then
        continue;
      end if;
      raise exception 'An already-final game requires the audited correction workflow.';
    end if;

    select * into locked_line
    from public.game_lines
    where game_id = target_game.id;

    if not found and exists (
      select 1
      from public.picks
      where game_id = target_game.id and result = 'pending'
    ) then
      raise exception 'A game with ATS picks cannot be finalized without an official line.';
    end if;

    update public.games
    set status = 'final',
        away_score = submitted_away_score,
        home_score = submitted_home_score,
        finalized_at = accepted_at
    where id = target_game.id;

    target_game.away_score := submitted_away_score;
    target_game.home_score := submitted_home_score;
    game_count := game_count + 1;

    if locked_line.game_id is not null then
      favorite_margin := case
        when locked_line.favorite_team_id = target_game.away_team_id
          then target_game.away_score - target_game.home_score
        else target_game.home_score - target_game.away_score
      end;

      update public.picks as pick
      set result = case
        when pick.selected_team_id = locked_line.favorite_team_id
          and favorite_margin > locked_line.locked_spread then 'win'
        when pick.selected_team_id <> locked_line.favorite_team_id
          and favorite_margin < locked_line.locked_spread then 'win'
        else 'loss'
      end
      where pick.game_id = target_game.id and pick.result = 'pending';

      get diagnostics updated_count = row_count;
      ats_count := ats_count + updated_count;
    end if;

    for survivor_result in
      select id::text
      from public.survivor_picks
      where game_id = target_game.id and result = 'pending'
    loop
      update public.survivor_picks as survivor_pick
      set result = case
        when survivor_pick.selected_team_id = target_game.away_team_id
          and target_game.away_score > target_game.home_score then 'win'
        when survivor_pick.selected_team_id = target_game.home_team_id
          and target_game.home_score > target_game.away_score then 'win'
        else 'loss'
      end
      where survivor_pick.id::text = survivor_result;

      survivor_count := survivor_count + 1;
    end loop;

    update public.survivor_entries as entry
    set status = 'eliminated',
        eliminated_scoring_period_id = target_game.scoring_period_id,
        eliminated_game_id = target_game.id,
        eliminated_at = accepted_at
    from public.survivor_picks as survivor_pick
    where survivor_pick.survivor_entry_id = entry.id
      and survivor_pick.game_id = target_game.id
      and survivor_pick.result = 'loss'
      and entry.status = 'active';

    insert into public.audit_logs (
      actor_player_id,
      action,
      entity_type,
      entity_id,
      details
    )
    values (
      null,
      'final_score_imported',
      'game',
      target_game.id,
      jsonb_build_object(
        'away_score',
        target_game.away_score,
        'home_score',
        target_game.home_score,
        'accepted_at',
        accepted_at
      )
    );
  end loop;

  return query select game_count, ats_count, survivor_count;
end;
$$;

-- Serialize every ATS replacement for the same player/week. The validation
-- trigger's count is then race-safe even if two saves arrive simultaneously.
create or replace function public.replace_unlocked_picks(
  target_player_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb
)
returns void
language plpgsql
as $$
declare
  final_ats_selections jsonb;
begin
  if jsonb_typeof(replacement_picks) is distinct from 'array' then
    raise exception 'ATS replacements must be submitted as an array.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      target_player_id::text || ':' || target_scoring_period_id::text,
      0
    )
  );

  delete from public.picks as existing_pick
  where existing_pick.player_id = target_player_id
    and existing_pick.scoring_period_id = target_scoring_period_id
    and existing_pick.result <> 'void'
    and exists (
      select 1
      from public.games as existing_game
      where existing_game.id = existing_pick.game_id
        and existing_game.kickoff_at > clock_timestamp()
    );

  insert into public.picks (
    player_id,
    scoring_period_id,
    game_id,
    selected_team_id
  )
  select
    target_player_id,
    target_scoring_period_id,
    (replacement_pick ->> 'game_id')::uuid,
    (replacement_pick ->> 'selected_team_id')::uuid
  from jsonb_array_elements(replacement_picks) as replacement_pick;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'game_id',
        game_id,
        'selected_team_id',
        selected_team_id
      )
      order by submitted_at, id
    ),
    '[]'::jsonb
  )
  into final_ats_selections
  from public.picks
  where player_id = target_player_id
    and scoring_period_id = target_scoring_period_id
    and result <> 'void';

  insert into public.audit_logs (
    actor_player_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    target_player_id,
    'ats_picks_saved',
    'scoring_period',
    target_scoring_period_id,
    jsonb_build_object(
      'scoring_mode',
      'against_spread',
      'selections',
      final_ats_selections
    )
  );
end;
$$;

-- Survivor revisions need the same player/week serialization. This avoids
-- simultaneous changes racing the one-pick and one-team-per-season rules.
create or replace function public.replace_unlocked_survivor_pick(
  target_survivor_entry_id uuid,
  target_scoring_period_id uuid,
  replacement_pick jsonb
)
returns void
language plpgsql
as $$
declare
  entry_player_id uuid;
  final_survivor_selection jsonb;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      target_survivor_entry_id::text || ':' || target_scoring_period_id::text,
      0
    )
  );

  select player_id
  into entry_player_id
  from public.survivor_entries
  where id = target_survivor_entry_id;

  if entry_player_id is null then
    raise exception 'The Survivor entry could not be found.';
  end if;

  delete from public.survivor_picks
  using public.games
  where survivor_picks.survivor_entry_id = target_survivor_entry_id
    and survivor_picks.scoring_period_id = target_scoring_period_id
    and survivor_picks.result <> 'void'
    and games.id = survivor_picks.game_id
    and games.kickoff_at > clock_timestamp();

  if replacement_pick is not null then
    insert into public.survivor_picks (
      survivor_entry_id,
      scoring_period_id,
      game_id,
      selected_team_id
    )
    values (
      target_survivor_entry_id,
      target_scoring_period_id,
      (replacement_pick ->> 'game_id')::uuid,
      (replacement_pick ->> 'selected_team_id')::uuid
    );
  end if;

  select jsonb_build_object(
    'game_id',
    game_id,
    'selected_team_id',
    selected_team_id
  )
  into final_survivor_selection
  from public.survivor_picks
  where survivor_entry_id = target_survivor_entry_id
    and scoring_period_id = target_scoring_period_id
    and result <> 'void';

  insert into public.audit_logs (
    actor_player_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    entry_player_id,
    case
      when final_survivor_selection is null then 'survivor_pick_cleared'
      else 'survivor_pick_saved'
    end,
    'scoring_period',
    target_scoring_period_id,
    jsonb_build_object(
      'scoring_mode',
      'straight_up',
      'spread_applied',
      false,
      'selection',
      final_survivor_selection
    )
  );
end;
$$;

-- The cron job retains its historical identifier to avoid a destructive
-- reschedule, but the Commissioner-facing description reflects email-only
-- delivery.
create or replace function public.automation_preflight()
returns table(check_id text, label text, passed boolean, detail text)
language sql
security definer
set search_path = public, cron, vault
as $$
  with required_jobs(job_name, job_label) as (
    values
      ('lock-official-lines-every-minute', 'Official line lock every minute'),
      ('refresh-nfl-schedule-and-spreads-prelock-early', 'Pre-lock schedule refresh (early)'),
      ('refresh-nfl-schedule-and-spreads-prelock-standard', 'Pre-lock schedule refresh (standard)'),
      ('refresh-final-nfl-scores-every-15-minutes', 'Final score refresh every 15 minutes'),
      ('send-pickem-browser-reminders-every-five-minutes', 'Email reminder delivery every five minutes')
  )
  select
    'cron-' || required_jobs.job_name,
    required_jobs.job_label,
    exists(
      select 1
      from cron.job
      where jobname = required_jobs.job_name and active
    ),
    case
      when exists(
        select 1
        from cron.job
        where jobname = required_jobs.job_name and active
      ) then 'Scheduled and active.'
      else 'Missing or inactive.'
    end
  from required_jobs
  union all
  select
    'cron-secret',
    'Shared automation secret',
    exists(
      select 1
      from vault.decrypted_secrets
      where name = 'cron_secret'
    ),
    case
      when exists(
        select 1
        from vault.decrypted_secrets
        where name = 'cron_secret'
      ) then 'Supabase can authenticate scheduled requests.'
      else 'The vault secret cron_secret is missing.'
    end;
$$;

revoke all on function public.finalize_games_atomically(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_automation_execution_lease(text, integer) from public, anon, authenticated;
revoke all on function public.release_automation_execution_lease(text, uuid) from public, anon, authenticated;
revoke all on function public.ensure_survivor_entries(uuid) from public, anon, authenticated;
revoke all on function public.replace_unlocked_picks(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.replace_unlocked_survivor_pick(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.void_disrupted_picks() from public, anon, authenticated;
revoke all on function public.record_game_disruption(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.claim_due_push_reminders() from public, anon, authenticated;
revoke all on function public.automation_preflight() from public, anon, authenticated;

grant execute on function public.finalize_games_atomically(jsonb, timestamptz) to service_role;
grant execute on function public.claim_automation_execution_lease(text, integer) to service_role;
grant execute on function public.release_automation_execution_lease(text, uuid) to service_role;
grant execute on function public.ensure_survivor_entries(uuid) to service_role;
grant execute on function public.replace_unlocked_picks(uuid, uuid, jsonb) to service_role;
grant execute on function public.replace_unlocked_survivor_pick(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.void_disrupted_picks() to service_role;
grant execute on function public.record_game_disruption(uuid, text, uuid) to service_role;
grant execute on function public.claim_due_push_reminders() to service_role;
grant execute on function public.automation_preflight() to service_role;
