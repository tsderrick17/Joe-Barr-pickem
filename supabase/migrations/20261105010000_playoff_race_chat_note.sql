-- The playoff race note: from the Divisional round on, at 6 AM Eastern the morning after each playoff game day, the
-- Commissioner's moderator note in the pool chat tells everyone where the race stands: how many playoff games are left,
-- who leads and with how many, everyone still alive with their wins and how far back they are, and who was knocked out.
-- It never names anyone's picks, and it never gives a "magic number".
--
-- The math is the pool's own playoff rule (see snapshot_playoff_day_eligibility): a player stays in while their wins plus
-- every remaining possible win can still tie the leader. Remaining possible wins count the games still to play in the
-- round, capped at its pick limit, plus each later round's pick limit until its games are loaded. "Knocked out" is a
-- player alive before the day began and out after it, which is exactly who the next day-start snapshot will scratch.
-- A player who forfeited is neither alive nor knocked out. The note waits until every game through that day is final
-- and graded, posts once per round and day (announcement_key), and skips the Wild Card round and the Super Bowl (the
-- champion's congratulations covers that).

alter table public.pool_chat_messages
  add column if not exists announcement_key text unique;

-- A moderator note can carry a full race report; players' messages keep their 280-character limit.
alter table public.pool_chat_messages
  drop constraint if exists pool_chat_messages_body_check;
alter table public.pool_chat_messages
  add constraint pool_chat_messages_body_check
  check (char_length(btrim(body)) between 1 and case when is_moderator then 1000 else 280 end);

create or replace function public.post_playoff_race_notes(
  evaluated_at timestamptz default clock_timestamp()
)
returns table(note_period_id uuid, note_day date, note_outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  race_day date;
  race_round record;
  note_key text;
  moderator_player_id uuid;
  remaining_before integer;
  remaining_after integer;
  leader_before integer;
  leader_after integer;
  leaders text[];
  alive text[];
  knocked text[];
  lead_line text;
  note_body text;
begin
  if evaluated_at is null or evaluated_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The playoff race note time is invalid.';
  end if;
  race_day := (evaluated_at at time zone 'America/New_York')::date - 1;

  for race_round in
    select distinct period.id, period.season_id, period.display_name, period.display_order
    from public.scoring_periods period
    join public.games game on game.scoring_period_id = period.id
    where period.period_type = 'playoff'
      and (game.kickoff_at at time zone 'America/New_York')::date = race_day
      and game.status not in ('postponed', 'cancelled', 'no_contest')
  loop
    note_period_id := race_round.id;
    note_day := race_day;
    note_key := 'playoff-race:' || race_round.id::text || ':' || race_day::text;

    -- From the Divisional round (the second playoff round) on.
    if (
      select count(*) from public.scoring_periods earlier
      where earlier.season_id = race_round.season_id
        and earlier.period_type = 'playoff'
        and earlier.display_order <= race_round.display_order
    ) < 2 then
      note_outcome := 'wild_card';
      return next;
      continue;
    end if;

    if exists (select 1 from public.pool_chat_messages message where message.announcement_key = note_key) then
      note_outcome := 'already_posted';
      return next;
      continue;
    end if;

    -- Only verified, graded results: every game through that day final and every pick on them graded.
    if exists (
      select 1
      from public.games game
      join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = race_round.season_id
        and (game.kickoff_at at time zone 'America/New_York')::date <= race_day
        and (game.status in ('scheduled', 'live') or (game.status = 'final' and game.finalized_at is null))
    ) or exists (
      select 1
      from public.picks pick
      join public.games game on game.id = pick.game_id
      join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = race_round.season_id
        and (game.kickoff_at at time zone 'America/New_York')::date <= race_day
        and pick.result = 'pending'
    ) then
      note_outcome := 'waiting_for_results';
      return next;
      continue;
    end if;

    select
      coalesce(sum(case when loaded.games = 0 then later.max_picks else least(loaded.from_day, later.max_picks) end), 0)::integer,
      coalesce(sum(case when loaded.games = 0 then later.max_picks else least(loaded.after_day, later.max_picks) end), 0)::integer
    into remaining_before, remaining_after
    from public.scoring_periods later
    cross join lateral (
      select
        count(*) filter (where game.status not in ('postponed', 'cancelled', 'no_contest')) as games,
        count(*) filter (where game.status in ('scheduled', 'live', 'final')
          and (game.kickoff_at at time zone 'America/New_York')::date >= race_day) as from_day,
        count(*) filter (where game.status in ('scheduled', 'live', 'final')
          and (game.kickoff_at at time zone 'America/New_York')::date > race_day) as after_day
      from public.games game
      where game.scoring_period_id = later.id
    ) loaded
    where later.season_id = race_round.season_id
      and later.period_type = 'playoff'
      and later.display_order >= race_round.display_order;

    if remaining_after = 0 then
      note_outcome := 'season_over';
      return next;
      continue;
    end if;

    with standing as (
      select player.id, player.first_name,
        count(counted.id) filter (where counted.result = 'win' and counted.game_day < race_day)::integer as wins_before,
        count(counted.id) filter (where counted.result = 'win' and counted.game_day <= race_day)::integer as wins_after,
        exists (
          select 1 from public.pickem_forfeits forfeit
          where forfeit.season_id = race_round.season_id and forfeit.player_id = player.id and forfeit.reversed_at is null
        ) as forfeited
      from public.players player
      left join lateral (
        select pick.id, pick.result, (game.kickoff_at at time zone 'America/New_York')::date as game_day
        from public.picks pick
        join public.games game on game.id = pick.game_id
        join public.scoring_periods period on period.id = game.scoring_period_id
        where pick.player_id = player.id and period.season_id = race_round.season_id
      ) counted on true
      where player.active
      group by player.id, player.first_name
    ), top as (
      select coalesce(max(wins_before), 0) as before_leader, coalesce(max(wins_after), 0) as after_leader from standing
    )
    select top.before_leader, top.after_leader,
      array_agg(standing.first_name order by standing.first_name) filter (where standing.wins_after = top.after_leader),
      array_agg(format('%s %s (%s back)', standing.first_name, standing.wins_after, top.after_leader - standing.wins_after)
        order by standing.wins_after desc, standing.first_name)
        filter (where not standing.forfeited and standing.wins_after < top.after_leader
          and standing.wins_after + remaining_after >= top.after_leader),
      array_agg(standing.first_name order by standing.first_name)
        filter (where not standing.forfeited
          and standing.wins_before + remaining_before >= top.before_leader
          and standing.wins_after + remaining_after < top.after_leader)
    into leader_before, leader_after, leaders, alive, knocked
    from standing cross join top
    group by top.before_leader, top.after_leader;

    select id into moderator_player_id
    from public.players
    where active and is_commissioner
    order by created_at, id
    limit 1;
    if moderator_player_id is null or coalesce(cardinality(leaders), 0) = 0 then
      note_outcome := 'no_moderator';
      return next;
      continue;
    end if;

    lead_line := case
      when cardinality(leaders) = 1 then format('%s leads with %s.', leaders[1], leader_after)
      else format('%s are tied for the lead at %s.',
        array_to_string(leaders[1:cardinality(leaders) - 1], ', ') || ' and ' || leaders[cardinality(leaders)], leader_after)
    end;
    note_body := format('🏈 %s %s is in the books. %s playoff game%s left.',
        race_round.display_name, to_char(race_day, 'FMDay'), remaining_after, case when remaining_after = 1 then '' else 's' end)
      || E'\n' || lead_line
      || case when coalesce(cardinality(alive), 0) > 0 then ' Still alive: ' || array_to_string(alive, ', ') || '.' else ' Nobody else can catch up.' end
      || case when coalesce(cardinality(knocked), 0) > 0 then E'\nKnocked out: '
        || case when cardinality(knocked) = 1 then knocked[1]
          else array_to_string(knocked[1:cardinality(knocked) - 1], ', ') || ' and ' || knocked[cardinality(knocked)] end
        || '.' else '' end;

    insert into public.pool_chat_messages (season_id, player_id, body, is_moderator, announcement_key)
    values (race_round.season_id, moderator_player_id, note_body, true, note_key)
    on conflict (announcement_key) do nothing;

    note_outcome := 'posted';
    return next;
  end loop;
end;
$$;

revoke all on function public.post_playoff_race_notes(timestamptz) from public, anon, authenticated;
grant execute on function public.post_playoff_race_notes(timestamptz) to service_role;

-- 6:00 to 9:45 AM Eastern, every fifteen minutes: the playoffs fall in January and February, always Eastern Standard
-- Time (UTC-5). The first run after the results are graded posts; the rest find it posted. Production exposes pg_cron
-- helper functions; isolated rehearsal databases do not.
do $migration$
declare
  job record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  for job in select jobid from cron.job where jobname = 'post-playoff-race-chat-note' loop
    if to_regprocedure('cron.unschedule(integer)') is not null then
      perform cron.unschedule(job.jobid::integer);
    elsif to_regprocedure('cron.unschedule(bigint)') is not null then
      perform cron.unschedule(job.jobid);
    end if;
  end loop;

  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('post-playoff-race-chat-note', '*/15 11-14 * * *', 'select public.post_playoff_race_notes();');
  elsif to_regprocedure('cron.schedule(text,text)') is not null then
    perform cron.schedule('*/15 11-14 * * *', 'select public.post_playoff_race_notes();');
  end if;
end
$migration$;
