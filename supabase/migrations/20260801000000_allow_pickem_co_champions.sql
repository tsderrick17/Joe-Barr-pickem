-- A shared Pick'em lead is a shared championship. This replaces the old
-- "leave the season uncrowned" behavior without changing Survivor's one-
-- champion rule. The ledger remains immutable and each champion still gets
-- one independent trophy/history/chat record.

alter table public.pool_championships
  drop constraint if exists pool_championships_season_year_pool_key;

create unique index if not exists pool_championships_player_pool_year_key
  on public.pool_championships (season_year, pool, player_id);

create unique index if not exists pool_championships_one_survivor_per_year_key
  on public.pool_championships (season_year, pool)
  where pool = 'survivor';

create or replace function public.record_survivor_championship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.survivor_champion_player_id is not null
    and old.survivor_champion_player_id is null then
    insert into public.pool_championships (season_id, season_year, pool, player_id, crowned_at)
    values (new.id, new.year, 'survivor', new.survivor_champion_player_id,
      coalesce(new.survivor_champion_crowned_at, clock_timestamp()))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.refresh_pickem_champion(target_season_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  target_year integer;
  recorded_champion_id uuid;
begin
  select year into target_year from public.seasons where id = target_season_id;
  if target_year is null then raise exception 'The Pick''em season does not exist.'; end if;

  if exists (
    select 1 from public.pool_championships
    where season_year = target_year and pool = 'pickem'
  ) then
    select player_id into recorded_champion_id from public.pool_championships
    where season_year = target_year and pool = 'pickem'
    order by player_id
    limit 1;
    return recorded_champion_id;
  end if;

  if exists (
    select 1 from public.scoring_periods
    where season_id = target_season_id and status <> 'complete'
  ) then
    return null;
  end if;

  with totals as (
    select p.player_id, count(*) filter (where p.result = 'win')::integer as wins
    from public.picks p
    join public.scoring_periods sp on sp.id = p.scoring_period_id
    where sp.season_id = target_season_id and p.result <> 'void'
    group by p.player_id
  ), leaders as (
    select player_id, wins, max(wins) over () as top_wins from totals
  )
  insert into public.pool_championships (season_id, season_year, pool, player_id, crowned_at)
  select target_season_id, target_year, 'pickem', player_id, clock_timestamp()
  from leaders
  where wins = top_wins
  on conflict do nothing;

  select player_id into recorded_champion_id from public.pool_championships
  where season_year = target_year and pool = 'pickem'
  order by player_id
  limit 1;
  return recorded_champion_id;
end;
$$;
