-- Schedule rows may be staged before teams and lines are known. The commissioner
-- import fills those fields later without changing the pool's pick rules.
alter table public.bowl_pool_games
  alter column away_team_id drop not null,
  alter column home_team_id drop not null;

alter table public.bowl_pool_games add column if not exists order_index integer;
update public.bowl_pool_games
set order_index = ranked.order_index
from (select id, row_number() over (partition by season_id order by kickoff_at, id) as order_index from public.bowl_pool_games) ranked
where public.bowl_pool_games.id = ranked.id and public.bowl_pool_games.order_index is null;
alter table public.bowl_pool_games alter column order_index set not null;

alter table public.bowl_pool_games
  drop constraint if exists bowl_pool_games_distinct_teams;

create index if not exists bowl_pool_games_season_order_idx
  on public.bowl_pool_games(season_id, order_index);
