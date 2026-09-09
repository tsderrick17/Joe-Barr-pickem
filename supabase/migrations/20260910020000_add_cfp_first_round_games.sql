-- Complete the 2026-27 CFP bracket with the four campus first-round games.
-- Teams and lines remain unset until the bracket is confirmed; stable keys make
-- this additive correction safe to replay after the original schedule seed.
with season as (select id from public.bowl_pool_seasons where season_year = 2026),
rows(provider_game_id,bowl_name,kickoff_at,order_index,venue_city,venue_state,time_confirmed) as (values
 ('cfp-2026-first-round-1','CFP First Round 1','2026-12-18 20:00:00-05',32,null,null,false),
 ('cfp-2026-first-round-2','CFP First Round 2','2026-12-19 12:00:00-05',33,null,null,false),
 ('cfp-2026-first-round-3','CFP First Round 3','2026-12-19 16:00:00-05',34,null,null,false),
 ('cfp-2026-first-round-4','CFP First Round 4','2026-12-19 20:00:00-05',35,null,null,false)
)
update public.bowl_pool_games
set order_index = order_index + 4
where season_id = (select id from season) and provider_game_id like 'cfp-%' and order_index >= 32;

with season as (select id from public.bowl_pool_seasons where season_year = 2026),
rows(provider_game_id,bowl_name,kickoff_at,order_index,venue_city,venue_state,time_confirmed) as (values
 ('cfp-2026-first-round-1','CFP First Round 1','2026-12-18 20:00:00-05',32,null,null,false),
 ('cfp-2026-first-round-2','CFP First Round 2','2026-12-19 12:00:00-05',33,null,null,false),
 ('cfp-2026-first-round-3','CFP First Round 3','2026-12-19 16:00:00-05',34,null,null,false),
 ('cfp-2026-first-round-4','CFP First Round 4','2026-12-19 20:00:00-05',35,null,null,false)
)
insert into public.bowl_pool_games (season_id,provider_game_id,bowl_name,kickoff_at,line_lock_at,order_index,venue_city,venue_state,time_confirmed,status,is_cfp)
select season.id, rows.provider_game_id, rows.bowl_name, rows.kickoff_at::timestamptz, rows.kickoff_at::timestamptz, rows.order_index, rows.venue_city, rows.venue_state, rows.time_confirmed, 'scheduled', true
from season cross join rows
on conflict (provider_game_id) do update set bowl_name=excluded.bowl_name,kickoff_at=excluded.kickoff_at,line_lock_at=excluded.line_lock_at,order_index=excluded.order_index,venue_city=excluded.venue_city,venue_state=excluded.venue_state,time_confirmed=excluded.time_confirmed,is_cfp=true;
