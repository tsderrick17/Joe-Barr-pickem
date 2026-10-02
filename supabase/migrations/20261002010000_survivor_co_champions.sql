-- Survivor always ends with a champion, so the annual turnover never stalls:
--  * one entry left after its week settles: that player wins;
--  * everyone left is eliminated in the same week: they share the title;
--  * several entries survive the whole regular season: they share the title.
-- A champion is decided only once the deciding week has settled, so a player
-- who outlasts the others on Sunday but loses on Monday shares the title
-- instead of winning it alone.
--
-- seasons.survivor_champion_player_id stays the "Survivor is over" marker the
-- app already reads (it holds one of the champions); pool_championships holds
-- every champion, one row each.

drop index if exists public.pool_championships_one_survivor_per_year_key;

create or replace function public.refresh_survivor_champion(
  target_season_id uuid,
  evaluated_at timestamptz default clock_timestamp()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  season_row public.seasons%rowtype;
  entry_count integer;
  active_count integer;
  deciding_period public.scoring_periods%rowtype;
  regular_season_done boolean;
  champion_ids uuid[];
  reason text;
begin
  select * into season_row from public.seasons where id = target_season_id for update;
  if not found then
    raise exception 'The Survivor season does not exist.';
  end if;
  if season_row.survivor_champion_player_id is not null then
    return season_row.survivor_champion_player_id;
  end if;

  select count(*), count(*) filter (where status = 'active')
    into entry_count, active_count
  from public.survivor_entries
  where season_id = target_season_id;

  -- A one-player Survivor is not a contest.
  if entry_count < 2 then
    return null;
  end if;

  -- The week of the most recent elimination decides a last-one or same-week finish.
  select period.* into deciding_period
  from public.survivor_entries entry
  join public.scoring_periods period on period.id = entry.eliminated_scoring_period_id
  where entry.season_id = target_season_id and entry.status = 'eliminated'
  order by period.display_order desc
  limit 1;

  select coalesce(bool_and(period.status = 'complete'), false) and count(*) > 0
    into regular_season_done
  from public.scoring_periods period
  where period.season_id = target_season_id and period.period_type = 'regular';

  if active_count = 1 and deciding_period.id is not null then
    -- The survivor must have come through the deciding week: it is complete,
    -- or the survivor's own pick that week has already won.
    if deciding_period.status <> 'complete' and not exists (
      select 1
      from public.survivor_entries entry
      join public.survivor_picks pick on pick.survivor_entry_id = entry.id
      where entry.season_id = target_season_id and entry.status = 'active'
        and pick.scoring_period_id = deciding_period.id and pick.result = 'win'
    ) then
      return null;
    end if;
    select array_agg(player_id order by player_id) into champion_ids
    from public.survivor_entries
    where season_id = target_season_id and status = 'active';
    reason := 'Last active Survivor entry remaining.';
  elsif active_count = 0 and deciding_period.id is not null then
    -- Everyone left went out together; wait until that week has settled.
    if deciding_period.status <> 'complete' then
      return null;
    end if;
    select array_agg(player_id order by player_id) into champion_ids
    from public.survivor_entries
    where season_id = target_season_id and status = 'eliminated'
      and eliminated_scoring_period_id = deciding_period.id;
    reason := 'Every remaining Survivor entry was eliminated in the same week.';
  elsif active_count >= 2 and regular_season_done then
    select array_agg(player_id order by player_id) into champion_ids
    from public.survivor_entries
    where season_id = target_season_id and status = 'active';
    reason := 'Several Survivor entries survived the regular season.';
  else
    return null;
  end if;

  if champion_ids is null or cardinality(champion_ids) = 0 then
    return null;
  end if;

  insert into public.pool_championships (season_id, season_year, pool, player_id, crowned_at)
  select target_season_id, season_row.year, 'survivor', champion_id, evaluated_at
  from unnest(champion_ids) as champion_id
  on conflict do nothing;

  update public.seasons
  set survivor_champion_player_id = champion_ids[1],
      survivor_champion_crowned_at = evaluated_at
  where id = target_season_id
    and survivor_champion_player_id is null;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (
    null, 'survivor_champion_crowned', 'season', target_season_id,
    jsonb_build_object('player_ids', to_jsonb(champion_ids), 'player_id', champion_ids[1], 'reason', reason)
  );

  return champion_ids[1];
end;
$$;

-- Re-check when a regular-season week settles: that is when a same-week
-- finish, or a full season with several survivors, becomes final.
create or replace function public.refresh_survivor_champion_after_period_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'complete' and old.status is distinct from new.status and new.period_type = 'regular' then
    perform public.refresh_survivor_champion(new.season_id, clock_timestamp());
  end if;
  return new;
end;
$$;

drop trigger if exists crown_survivor_champion_after_period_complete on public.scoring_periods;
create trigger crown_survivor_champion_after_period_complete
after update of status on public.scoring_periods
for each row
execute function public.refresh_survivor_champion_after_period_complete();

-- A pick that wins can settle a last-one finish before the week completes.
create or replace function public.refresh_survivor_champion_after_pick_graded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_season uuid;
begin
  if new.result = 'win' and old.result is distinct from new.result then
    select season_id into target_season from public.survivor_entries where id = new.survivor_entry_id;
    if target_season is not null then
      perform public.refresh_survivor_champion(target_season, clock_timestamp());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists crown_survivor_champion_after_pick_graded on public.survivor_picks;
create trigger crown_survivor_champion_after_pick_graded
after update of result on public.survivor_picks
for each row
execute function public.refresh_survivor_champion_after_pick_graded();

revoke all on function public.refresh_survivor_champion(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.refresh_survivor_champion_after_period_complete() from public, anon, authenticated;
revoke all on function public.refresh_survivor_champion_after_pick_graded() from public, anon, authenticated;
grant execute on function public.refresh_survivor_champion(uuid, timestamptz) to service_role;
