-- The playoff race note, refined again by the owner: the leader line says only "Gary leads." (no score), and when the
-- leader's magic number is 5 or less it follows: "Gary leads. Magic number: 3". The magic number is how many leader wins
-- plus losses by the closest chaser still alive put the title out of everyone else's reach: games left minus the gap
-- to that chaser, plus one (a player stays in while they can still tie). Co-leaders read "Gary and Connor are tied for
-- the lead." with no number. Everything else is as in 20261105020000_playoff_race_note_every_day.sql.
--
--   4 games left.
--   Gary leads. Magic number: 3
--   2 back: Connor
--   3 back: Rick and Tyler
--   Knocked out yesterday: Al and Dana
--   Forfeited yesterday: Bob

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
  leader_after integer;
  closest_after integer;
  magic_number integer;
  leaders text[];
  back_lines text;
  knocked text[];
  forfeited text[];
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
    ), chasing as (
      select top.after_leader - standing.wins_after as back,
        array_agg(standing.first_name order by standing.first_name) as names
      from standing cross join top
      where not standing.forfeited
        and standing.wins_after < top.after_leader
        and standing.wins_after + remaining_after >= top.after_leader
      group by top.after_leader - standing.wins_after
    )
    select top.after_leader,
      (select max(standing.wins_after) from standing
        where not standing.forfeited and standing.wins_after < top.after_leader
          and standing.wins_after + remaining_after >= top.after_leader),
      (select array_agg(standing.first_name order by standing.first_name) from standing where standing.wins_after = top.after_leader),
      (select string_agg(format('%s back: %s', chasing.back, public.race_note_names(chasing.names)), E'\n' order by chasing.back) from chasing),
      (select array_agg(standing.first_name order by standing.first_name) from standing
        where not standing.forfeited
          and standing.wins_before + remaining_before >= top.before_leader
          and standing.wins_after + remaining_after < top.after_leader)
    into leader_after, closest_after, leaders, back_lines, knocked
    from top;

    select array_agg(player.first_name order by player.first_name) into forfeited
    from public.pickem_forfeits forfeit
    join public.players player on player.id = forfeit.player_id
    where forfeit.season_id = race_round.season_id
      and forfeit.reversed_at is null
      and (forfeit.forfeited_at at time zone 'America/New_York')::date = race_day;

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

    -- The leader's magic number: leader wins plus losses by the closest chaser still alive that put the title out of
    -- everyone else's reach (once the gap is more than the games left, nobody can tie). Shown only when it is 5 or less.
    magic_number := case when closest_after is null then null else remaining_after - (leader_after - closest_after) + 1 end;

    note_body := format('%s game%s left.', remaining_after, case when remaining_after = 1 then '' else 's' end)
      || E'\n' || case
        when cardinality(leaders) = 1 then format('%s leads.', leaders[1])
          || case when magic_number between 1 and 5 then format(' Magic number: %s', magic_number) else '' end
        else format('%s are tied for the lead.', public.race_note_names(leaders))
      end
      || E'\n' || coalesce(back_lines, 'Nobody else can catch up.')
      || case when coalesce(cardinality(knocked), 0) > 0 then E'\nKnocked out yesterday: ' || public.race_note_names(knocked) else '' end
      || case when coalesce(cardinality(forfeited), 0) > 0 then E'\nForfeited yesterday: ' || public.race_note_names(forfeited) else '' end;

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
