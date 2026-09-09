-- Bowl Pool champions use the same immutable trophy ledger as the other pools.
alter table public.pool_championships drop constraint if exists pool_championships_pool_check;
alter table public.pool_championships add constraint pool_championships_pool_check check (pool in ('pickem', 'survivor', 'bowl'));

-- Preserve last year's explicitly supplied Bowl Pool winner once.
insert into public.pool_championships (season_year, pool, player_id, crowned_at)
select 2025, 'bowl', id, timestamptz '2026-01-25 00:00:00+00'
from public.players where lower(trim(first_name)) = 'al'
on conflict (season_year, pool) do nothing;

create or replace function public.refresh_bowl_pool_champion(target_season_id uuid, evaluated_at timestamptz default clock_timestamp())
returns integer language plpgsql security definer set search_path = public as $$
declare season_year_value integer; game_count integer; final_count integer; championship_game uuid; final_total integer; inserted_count integer := 0;
begin
  select season_year, championship_game_id into season_year_value, championship_game from public.bowl_pool_seasons where id = target_season_id;
  if season_year_value is null or championship_game is null then return 0; end if;
  select count(*), count(*) filter (where status = 'final') into game_count, final_count from public.bowl_pool_games where season_id = target_season_id;
  if game_count = 0 or final_count <> game_count then return 0; end if;
  select away_score + home_score into final_total from public.bowl_pool_games where id = championship_game and status = 'final';
  if final_total is null then return 0; end if;
  with totals as (
    select entry.id, entry.player_id, entry.championship_total_guess, count(*) filter (where pick.result = 'win' or result.result = 'win')::integer as wins
    from public.bowl_pool_entries entry left join public.bowl_pool_picks pick on pick.entry_id = entry.id left join public.bowl_pool_game_results result on result.entry_id = entry.id and result.game_id = pick.game_id
    where entry.season_id = target_season_id and entry.status in ('active', 'complete') and entry.championship_total_guess is not null group by entry.id, entry.player_id, entry.championship_total_guess
  ), ranked as (select *, abs(championship_total_guess - final_total) as difference, max(wins) over () as top_wins from totals), winners as (select * from ranked where wins = top_wins and difference = (select min(difference) from ranked where wins = top_wins))
  insert into public.bowl_pool_championships (season_id, player_id, wins, championship_total_guess, final_total_difference)
  select target_season_id, player_id, wins, championship_total_guess, difference from winners on conflict (season_id, player_id) do nothing;
  get diagnostics inserted_count = row_count;
  insert into public.pool_championships (season_year, pool, player_id, crowned_at) select season_year_value, 'bowl', player_id, evaluated_at from public.bowl_pool_championships where season_id = target_season_id on conflict (season_year, pool, player_id) do nothing;
  return inserted_count;
end; $$;
revoke all on function public.refresh_bowl_pool_champion(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.refresh_bowl_pool_champion(uuid, timestamptz) to service_role;
