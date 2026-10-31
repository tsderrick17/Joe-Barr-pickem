-- Three Bowl Pool schedule fixes ahead of the December 1 ESPN pull and the December 7 launch.

-- 1. A game whose kickoff is a placeholder (time_confirmed = false: ESPN has the day but not the time) may have its kickoff
-- corrected even after picks or a locked line exist. Otherwise a player's early pick would freeze the placeholder, and a real
-- kickoff earlier than the placeholder would leave the game open for picks after it started. Teams stay frozen as before, and
-- a confirmed kickoff stays frozen too.
create or replace function public.protect_bowl_game_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.away_team_id is distinct from new.away_team_id or old.home_team_id is distinct from new.home_team_id
      or (old.kickoff_at is distinct from new.kickoff_at and old.time_confirmed))
     and (exists (select 1 from bowl_pool_picks where game_id=old.id)
          or exists (select 1 from bowl_pool_game_lines where game_id=old.id and locked_at is not null)) then
    raise exception 'A Bowl Pool matchup with picks or a locked line cannot be replaced.';
  end if;
  return new;
end; $$;

-- 2. Five FBS bowls ESPN lists that the September calendar lacked (the Celebration Bowl, an FCS game, stays out by choice).
-- Their times are ESPN's; the San Juan Bowl has a day but no time yet, so it waits at noon Eastern marked "Time TBD".
with season as (select id from public.bowl_pool_seasons where season_year = 2026),
rows(provider_game_id, bowl_name, kickoff_at, venue_city, venue_state, time_confirmed, order_index) as (values
  ('bowl-2026-san-juan', 'San Juan', '2026-12-16 12:00:00-05'::timestamptz, 'San Juan', 'PR', false, 1001),
  ('bowl-2026-poinsettia', 'Poinsettia', '2026-12-23 19:30:00-05'::timestamptz, 'San Diego', 'CA', true, 1002),
  ('bowl-2026-holiday', 'Holiday', '2026-12-28 17:00:00-05'::timestamptz, 'San Diego', 'CA', true, 1003),
  ('bowl-2026-sun', 'Sun', '2026-12-31 14:00:00-05'::timestamptz, 'El Paso', 'TX', true, 1004),
  ('bowl-2027-arizona', 'Arizona', '2027-01-02 16:30:00-05'::timestamptz, 'Tucson', 'AZ', true, 1005)
)
insert into public.bowl_pool_games (season_id, provider_game_id, bowl_name, kickoff_at, line_lock_at, order_index, venue_city, venue_state, time_confirmed, status)
select season.id, rows.provider_game_id, rows.bowl_name, rows.kickoff_at,
       (((rows.kickoff_at at time zone 'America/New_York')::date + time '08:00') at time zone 'America/New_York'),
       rows.order_index, rows.venue_city, rows.venue_state, rows.time_confirmed, 'scheduled'
from season cross join rows
on conflict (provider_game_id) do nothing;

-- 3. The display order is by kickoff (the rule since 20260911010000); put the new games in their places.
with ranked as (
  select id, row_number() over (order by kickoff_at, order_index, id)::integer as repaired_order
  from public.bowl_pool_games
  where season_id = (select id from public.bowl_pool_seasons where season_year = 2026)
)
update public.bowl_pool_games games
set order_index = ranked.repaired_order
from ranked
where games.id = ranked.id and games.order_index is distinct from ranked.repaired_order;
