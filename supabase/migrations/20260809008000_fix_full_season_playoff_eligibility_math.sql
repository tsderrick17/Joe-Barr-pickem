-- Playoff eligibility is based on the complete Pick'em record. A player who
-- cannot tie the season leader with every remaining playoff selection is out
-- before the next game day begins. Keep the immutable day-start snapshot, but
-- count regular-season wins and never invent more possible wins than the
-- remaining schedule or period pick limit permits.

create or replace function public.snapshot_playoff_day_eligibility(
  target_scoring_period_id uuid,
  evaluated_at timestamptz default clock_timestamp()
)
returns table(snapshot_day date, players_eligible integer, players_eliminated integer, picks_scratched integer)
language plpgsql security definer set search_path = public as $$
declare
  target_period public.scoring_periods%rowtype;
  eastern_today date;
  effective_day date;
  eligible_count integer := 0;
  eliminated_count integer := 0;
  scratched_count integer := 0;
begin
  if evaluated_at is null or evaluated_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The playoff eligibility evaluation time is invalid.';
  end if;

  select * into target_period from public.scoring_periods
  where id = target_scoring_period_id for update;
  if not found then raise exception 'The playoff scoring period could not be found.'; end if;
  if target_period.period_type <> 'playoff' or target_period.status <> 'active' then
    return query select null::date, 0, 0, 0;
    return;
  end if;

  eastern_today := (evaluated_at at time zone 'America/New_York')::date;
  select coalesce(
    min((game.kickoff_at at time zone 'America/New_York')::date) filter (
      where game.status in ('scheduled', 'live')
        and (game.kickoff_at at time zone 'America/New_York')::date >= eastern_today
    ), eastern_today
  ) into effective_day
  from public.games game where game.scoring_period_id = target_period.id;

  perform pg_advisory_xact_lock(hashtextextended(target_period.id::text || ':' || effective_day::text, 0));

  with season_periods as (
    select id from public.scoring_periods where season_id = target_period.season_id
  ), future_playoff_periods as (
    select id, display_order, max_picks, status
    from public.scoring_periods
    where season_id = target_period.season_id
      and period_type = 'playoff'
      and display_order >= target_period.display_order
  ), active_players as (
    select id from public.players where active
  ), wins_at_start as (
    select player.id as player_id,
      count(pick.id) filter (
        where pick.result = 'win'
          and season_period.id is not null
          and (game.kickoff_at at time zone 'America/New_York')::date < effective_day
      )::integer as wins
    from active_players player
    left join public.picks pick on pick.player_id = player.id and pick.result <> 'void'
    left join public.games game on game.id = pick.game_id
    left join season_periods season_period on season_period.id = game.scoring_period_id
    group by player.id
  ), remaining_games as (
    select period.id,
      case
        -- Later playoff schedules are dynamic and may not be loaded yet. Use
        -- their configured pick capacity so nobody is eliminated early merely
        -- because the provider has not published that round.
        when period.id <> target_period.id then period.max_picks
        else least(
          count(game.id) filter (
            where game.status in ('scheduled', 'live')
              and (game.kickoff_at at time zone 'America/New_York')::date >= effective_day
          )::integer,
          period.max_picks
        )
      end as possible_wins
    from future_playoff_periods period
    left join public.games game on game.scoring_period_id = period.id
    group by period.id, period.max_picks
  ), totals as (
    select coalesce(max(wins), 0) as leader_wins,
      coalesce((select sum(possible_wins) from remaining_games), 0)::integer as remaining_wins
    from wins_at_start
  ), calculated as (
    select target_period.season_id as season_id,
      target_period.id as scoring_period_id, effective_day as game_day,
      wins.player_id, wins.wins as wins_at_day_start,
      totals.leader_wins as leader_wins_at_day_start,
      totals.remaining_wins as remaining_possible_wins,
      wins.wins + totals.remaining_wins >= totals.leader_wins as is_eligible
    from wins_at_start wins cross join totals
  ), inserted as (
    insert into public.playoff_day_eligibility (
      season_id, scoring_period_id, game_day, player_id,
      wins_at_day_start, leader_wins_at_day_start, remaining_possible_wins,
      is_eligible, evaluated_at
    ) select season_id, scoring_period_id, game_day, player_id,
      wins_at_day_start, leader_wins_at_day_start, remaining_possible_wins,
      is_eligible, evaluated_at
    from calculated
    on conflict (scoring_period_id, game_day, player_id) do nothing
    returning *
  ), snapshot_audit as (
    insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
    select null, 'playoff_day_eligibility_recorded', 'player', inserted.player_id,
      jsonb_build_object(
        'season_id', inserted.season_id, 'scoring_period_id', inserted.scoring_period_id,
        'game_day', inserted.game_day, 'wins_at_day_start', inserted.wins_at_day_start,
        'leader_wins_at_day_start', inserted.leader_wins_at_day_start,
        'remaining_possible_wins', inserted.remaining_possible_wins,
        'is_eligible', inserted.is_eligible
      ) from inserted
  ), scratched as (
    update public.picks pick set result = 'void'
    from public.playoff_day_eligibility eligibility,
      public.games game, future_playoff_periods period
    where eligibility.scoring_period_id = target_period.id
      and eligibility.game_day = effective_day
      and eligibility.player_id = pick.player_id
      and not eligibility.is_eligible
      and pick.result = 'pending'
      and game.id = pick.game_id
      and period.id = game.scoring_period_id
      and (game.kickoff_at at time zone 'America/New_York')::date >= effective_day
    returning pick.id, pick.player_id, pick.game_id
  ), scratch_audit as (
    insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
    select null, 'playoff_pick_scratched', 'pick', scratched.id,
      jsonb_build_object(
        'player_id', scratched.player_id, 'game_id', scratched.game_id,
        'scoring_period_id', target_period.id, 'effective_game_day', effective_day,
        'reason', 'Player was mathematically eliminated before this playoff game day began.'
      ) from scratched returning 1
  )
  select count(*) filter (where eligibility.is_eligible)::integer,
    count(*) filter (where not eligibility.is_eligible)::integer,
    (select count(*)::integer from scratch_audit)
  into eligible_count, eliminated_count, scratched_count
  from public.playoff_day_eligibility eligibility
  where eligibility.scoring_period_id = target_period.id
    and eligibility.game_day = effective_day;

  return query select effective_day, eligible_count, eliminated_count, scratched_count;
end;
$$;

revoke all on function public.snapshot_playoff_day_eligibility(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.snapshot_playoff_day_eligibility(uuid, timestamptz)
  to service_role;
