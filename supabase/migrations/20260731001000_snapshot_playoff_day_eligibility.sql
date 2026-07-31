-- Playoff eligibility is assessed once for each actual Eastern game day. The
-- snapshot is immutable: a player who can still tie the leader at the start
-- of a day keeps that entire day, while a player already out has any early
-- selections for that day (and later playoff days) scratched with an audit
-- receipt. This prevents both mid-slate lockouts and post-elimination wins.

create table if not exists public.playoff_day_eligibility (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  scoring_period_id uuid not null references public.scoring_periods(id) on delete cascade,
  game_day date not null,
  player_id uuid not null references public.players(id) on delete cascade,
  wins_at_day_start integer not null check (wins_at_day_start >= 0),
  leader_wins_at_day_start integer not null check (leader_wins_at_day_start >= 0),
  remaining_possible_wins integer not null check (remaining_possible_wins >= 0),
  is_eligible boolean not null,
  evaluated_at timestamptz not null default clock_timestamp(),
  unique (scoring_period_id, game_day, player_id)
);

create index if not exists playoff_day_eligibility_lookup_idx
  on public.playoff_day_eligibility (scoring_period_id, game_day, player_id);

alter table public.playoff_day_eligibility enable row level security;
revoke all on public.playoff_day_eligibility from public, anon, authenticated;
grant select, insert on public.playoff_day_eligibility to service_role;

create or replace function public.snapshot_playoff_day_eligibility(
  target_scoring_period_id uuid,
  evaluated_at timestamptz default clock_timestamp()
)
returns table(
  snapshot_day date,
  players_eligible integer,
  players_eliminated integer,
  picks_scratched integer
)
language plpgsql
security definer
set search_path = public
as $$
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

  select * into target_period
  from public.scoring_periods
  where id = target_scoring_period_id
  for update;

  if not found then
    raise exception 'The playoff scoring period could not be found.';
  end if;
  if target_period.period_type <> 'playoff' or target_period.status <> 'active' then
    return query select null::date, 0, 0, 0;
    return;
  end if;

  eastern_today := (evaluated_at at time zone 'America/New_York')::date;

  -- Between game days, evaluate against the next game day. That lets a
  -- Tuesday/Saturday early selection be scratched before the next slate,
  -- while Sunday players retain every Sunday game they were entitled to at
  -- the start of that day.
  select coalesce(
    min((game.kickoff_at at time zone 'America/New_York')::date)
      filter (
        where game.status in ('scheduled', 'live')
          and (game.kickoff_at at time zone 'America/New_York')::date >= eastern_today
      ),
    eastern_today
  )
  into effective_day
  from public.games as game
  where game.scoring_period_id = target_period.id;

  perform pg_advisory_xact_lock(
    hashtextextended(target_period.id::text || ':' || effective_day::text, 0)
  );

  with relevant_periods as (
    select id, display_order, max_picks
    from public.scoring_periods
    where season_id = target_period.season_id
      and period_type = 'playoff'
      and display_order >= target_period.display_order
  ),
  active_players as (
    select id from public.players where active
  ),
  wins_at_start as (
    select
      player.id as player_id,
      count(pick.id) filter (
        where pick.result = 'win'
          and period.id is not null
          and (game.kickoff_at at time zone 'America/New_York')::date < effective_day
      )::integer as wins
    from active_players as player
    left join public.picks as pick on pick.player_id = player.id and pick.result <> 'void'
    left join public.games as game on game.id = pick.game_id
    left join relevant_periods as period on period.id = game.scoring_period_id
    group by player.id
  ),
  remaining_games as (
    select
      period.id,
      greatest(
        count(game.id) filter (
          where game.status not in ('cancelled', 'postponed')
            and (
              period.id <> target_period.id
              or (game.kickoff_at at time zone 'America/New_York')::date >= effective_day
            )
        )::integer,
        case when period.id = target_period.id then 0 else period.max_picks end
      ) as possible_wins
    from relevant_periods as period
    left join public.games as game on game.scoring_period_id = period.id
    group by period.id, period.max_picks
  ),
  totals as (
    select
      coalesce(max(wins), 0) as leader_wins,
      coalesce((select sum(possible_wins) from remaining_games), 0)::integer as remaining_wins
    from wins_at_start
  ),
  calculated as (
    select
      target_period.season_id as season_id,
      target_period.id as scoring_period_id,
      effective_day as game_day,
      wins.player_id,
      wins.wins as wins_at_day_start,
      totals.leader_wins as leader_wins_at_day_start,
      totals.remaining_wins as remaining_possible_wins,
      wins.wins + totals.remaining_wins >= totals.leader_wins as is_eligible
    from wins_at_start as wins
    cross join totals
  ),
  inserted as (
    insert into public.playoff_day_eligibility (
      season_id, scoring_period_id, game_day, player_id,
      wins_at_day_start, leader_wins_at_day_start, remaining_possible_wins,
      is_eligible, evaluated_at
    )
    select
      season_id, scoring_period_id, game_day, player_id,
      wins_at_day_start, leader_wins_at_day_start, remaining_possible_wins,
      is_eligible, evaluated_at
    from calculated
    on conflict (scoring_period_id, game_day, player_id) do nothing
    returning *
  ),
  snapshot_audit as (
    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    select
      null,
      'playoff_day_eligibility_recorded',
      'player',
      inserted.player_id,
      jsonb_build_object(
        'season_id', inserted.season_id,
        'scoring_period_id', inserted.scoring_period_id,
        'game_day', inserted.game_day,
        'wins_at_day_start', inserted.wins_at_day_start,
        'leader_wins_at_day_start', inserted.leader_wins_at_day_start,
        'remaining_possible_wins', inserted.remaining_possible_wins,
        'is_eligible', inserted.is_eligible
      )
    from inserted
  ),
  scratched as (
    update public.picks as pick
    set result = 'void'
    from public.playoff_day_eligibility as eligibility,
      public.games as game,
      relevant_periods as period
    where eligibility.scoring_period_id = target_period.id
      and eligibility.game_day = effective_day
      and eligibility.player_id = pick.player_id
      and not eligibility.is_eligible
      and pick.result = 'pending'
      and game.id = pick.game_id
      and period.id = game.scoring_period_id
      and (game.kickoff_at at time zone 'America/New_York')::date >= effective_day
    returning pick.id, pick.player_id, pick.game_id
  ),
  scratch_audit as (
    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    select
      null,
      'playoff_pick_scratched',
      'pick',
      scratched.id,
      jsonb_build_object(
        'player_id', scratched.player_id,
        'game_id', scratched.game_id,
        'scoring_period_id', target_period.id,
        'effective_game_day', effective_day,
        'reason', 'Player was mathematically eliminated before this playoff game day began.'
      )
    from scratched
    returning 1
  )
  select
    count(*) filter (where eligibility.is_eligible)::integer,
    count(*) filter (where not eligibility.is_eligible)::integer,
    (select count(*)::integer from scratch_audit)
  into eligible_count, eliminated_count, scratched_count
  from public.playoff_day_eligibility as eligibility
  where eligibility.scoring_period_id = target_period.id
    and eligibility.game_day = effective_day;

  return query select effective_day, eligible_count, eliminated_count, scratched_count;
end;
$$;

revoke all on function public.snapshot_playoff_day_eligibility(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.snapshot_playoff_day_eligibility(uuid, timestamptz)
  to service_role;
