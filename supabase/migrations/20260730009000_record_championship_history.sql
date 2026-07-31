-- Championship history is an immutable pool record. It powers the trophy
-- hover cards and means a new season never requires a code change to move a
-- trophy from one player to another.

create table if not exists public.pool_championships (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete set null,
  season_year integer not null check (season_year >= 2025),
  pool text not null check (pool in ('pickem', 'survivor')),
  player_id uuid not null references public.players(id) on delete restrict,
  crowned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (season_year, pool)
);

create index if not exists pool_championships_player_year_idx
  on public.pool_championships (player_id, season_year desc);

alter table public.pool_championships enable row level security;

-- Preserve the inaugural records once. Runtime code never relies on names.
insert into public.pool_championships (season_year, pool, player_id, crowned_at)
select 2025, 'pickem', id, timestamptz '2026-01-01 00:00:00+00'
from public.players where lower(first_name) = 'steve'
on conflict (season_year, pool) do nothing;

insert into public.pool_championships (season_year, pool, player_id, crowned_at)
select 2025, 'survivor', id, timestamptz '2026-01-01 00:00:00+00'
from public.players where lower(first_name) = 'john'
on conflict (season_year, pool) do nothing;

-- Record any Survivor champion already crowned by the existing integrity
-- trigger, then mirror every future crowning event into the ledger.
insert into public.pool_championships (season_id, season_year, pool, player_id, crowned_at)
select id, year, 'survivor', survivor_champion_player_id,
  coalesce(survivor_champion_crowned_at, now())
from public.seasons where survivor_champion_player_id is not null
on conflict (season_year, pool) do nothing;

create or replace function public.record_survivor_championship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.survivor_champion_player_id is not null
    and old.survivor_champion_player_id is null then
    insert into public.pool_championships (season_id, season_year, pool, player_id, crowned_at)
    values (new.id, new.year, 'survivor', new.survivor_champion_player_id,
      coalesce(new.survivor_champion_crowned_at, clock_timestamp()))
    on conflict (season_year, pool) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists record_survivor_championship on public.seasons;
create trigger record_survivor_championship
after update of survivor_champion_player_id on public.seasons
for each row execute function public.record_survivor_championship();

-- A Pick'em championship is created only after every period is complete and
-- there is one clear leader. A tied season remains uncrowned until the pool's
-- official tie-break rule supplies a result.
create or replace function public.refresh_pickem_champion(target_season_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  target_year integer;
  champion_player_id uuid;
  lead_wins integer;
  lead_count integer;
begin
  select year into target_year from public.seasons where id = target_season_id;
  if target_year is null then raise exception 'The Pick''em season does not exist.'; end if;

  select player_id into champion_player_id from public.pool_championships
  where season_year = target_year and pool = 'pickem';
  if champion_player_id is not null then return champion_player_id; end if;

  if exists (select 1 from public.scoring_periods where season_id = target_season_id and status <> 'complete') then
    return null;
  end if;

  with totals as (
    select p.player_id, count(*) filter (where p.result = 'win')::integer as wins
    from public.picks p join public.scoring_periods sp on sp.id = p.scoring_period_id
    where sp.season_id = target_season_id and p.result <> 'void'
    group by p.player_id
  ), leader as (
    select player_id, wins, max(wins) over () as top_wins from totals
  )
  select (array_agg(player_id) filter (where wins = top_wins))[1], max(top_wins), count(*) filter (where wins = top_wins)
  into champion_player_id, lead_wins, lead_count from leader;

  if champion_player_id is null or lead_wins is null or lead_count <> 1 then return null; end if;

  insert into public.pool_championships (season_id, season_year, pool, player_id, crowned_at)
  values (target_season_id, target_year, 'pickem', champion_player_id, clock_timestamp())
  on conflict (season_year, pool) do nothing;
  return champion_player_id;
end;
$$;

create or replace function public.refresh_pickem_champion_after_period_complete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'complete' and old.status is distinct from new.status then
    perform public.refresh_pickem_champion(new.season_id);
  end if;
  return new;
end;
$$;

drop trigger if exists record_pickem_championship_after_period_complete on public.scoring_periods;
create trigger record_pickem_championship_after_period_complete
after update of status on public.scoring_periods
for each row execute function public.refresh_pickem_champion_after_period_complete();

revoke all on public.pool_championships from public, anon, authenticated;
revoke all on function public.record_survivor_championship() from public, anon, authenticated;
revoke all on function public.refresh_pickem_champion(uuid) from public, anon, authenticated;
revoke all on function public.refresh_pickem_champion_after_period_complete() from public, anon, authenticated;
grant select, insert on public.pool_championships to service_role;
grant execute on function public.refresh_pickem_champion(uuid) to service_role;
