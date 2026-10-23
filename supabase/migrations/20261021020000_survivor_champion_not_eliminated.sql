-- A crowned Survivor champion stays an active entry and makes no further Survivor picks, so the no-pick rule used to eliminate the champion in the
-- following week (and the recap then reported the winner as eliminated). The rule now leaves a season alone once its champion is crowned.
create or replace function public.eliminate_survivor_no_picks(
  evaluated_at timestamptz default clock_timestamp()
)
returns table(entries_eliminated integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  eliminated_count integer := 0;
begin
  if evaluated_at is null or evaluated_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The Survivor no-pick evaluation time is invalid.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('survivor-no-pick-evaluation', 0));

  with closed_periods as (
    select period.id, period.season_id, period.display_order,
      max(game.kickoff_at) as final_kickoff_at
    from public.scoring_periods period
    join public.games game on game.scoring_period_id = period.id
      and game.status not in ('postponed', 'cancelled', 'no_contest')
    group by period.id, period.season_id, period.display_order
    having max(game.kickoff_at) <= evaluated_at
  ), overdue_entries as (
    select distinct on (entry.id) entry.id as entry_id, period.id as scoring_period_id
    from public.survivor_entries entry
    join closed_periods period on period.season_id = entry.season_id
      and entry.entered_at <= period.final_kickoff_at
    where entry.status = 'active'
      -- Once the season has a crowned Survivor champion the competition is over: nobody makes Survivor picks any more, so a missing pick must never
      -- eliminate the champion (or anyone else) in a later week.
      and not exists (
        select 1 from public.seasons season
        where season.id = entry.season_id
          and season.survivor_champion_player_id is not null
          and season.survivor_champion_crowned_at is not null
          and season.survivor_champion_crowned_at <= period.final_kickoff_at
      )
      and not exists (
        select 1 from public.survivor_picks survivor_pick
        where survivor_pick.survivor_entry_id = entry.id
          and survivor_pick.scoring_period_id = period.id
      )
    order by entry.id, period.display_order
  ), eliminated as (
    update public.survivor_entries entry
    set status = 'eliminated', eliminated_scoring_period_id = overdue.scoring_period_id,
        eliminated_game_id = null, eliminated_at = evaluated_at
    from overdue_entries overdue
    where entry.id = overdue.entry_id and entry.status = 'active'
    returning entry.id, entry.player_id, entry.eliminated_scoring_period_id
  ), audited as (
    insert into public.audit_logs(actor_player_id, action, entity_type, entity_id, details)
    select null, 'survivor_no_pick_eliminated', 'survivor_entry', eliminated.id,
      jsonb_build_object('player_id', eliminated.player_id,
        'scoring_period_id', eliminated.eliminated_scoring_period_id,
        'reason', 'No Survivor selection was made before the final eligible kickoff.')
    from eliminated returning 1
  )
  select count(*) into eliminated_count from audited;
  return query select eliminated_count;
end;
$$;


revoke all on function public.eliminate_survivor_no_picks(timestamptz)
  from public, anon, authenticated;
grant execute on function public.eliminate_survivor_no_picks(timestamptz)
  to service_role;
