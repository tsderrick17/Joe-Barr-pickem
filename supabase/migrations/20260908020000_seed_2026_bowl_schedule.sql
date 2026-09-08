-- Stage the confirmed 2026-27 FBS bowl calendar. Matchups and lines remain
-- blank until selection day; the stable keys make later updates idempotent.
with season as (
  insert into public.bowl_pool_seasons (season_year, player_visible_at)
  values (2026, '2026-12-07 03:00:00-05'::timestamptz)
  on conflict (season_year) do update set player_visible_at = excluded.player_visible_at
  returning id
), rows(provider_game_id, bowl_name, kickoff_at, order_index) as (values
 ('bowl-2026-salute-veterans','Salute to Veterans Bowl','2026-12-15 17:30:00-05',1),
 ('bowl-2026-frisco-classic','Frisco Football Classic','2026-12-15 21:00:00-05',2),
 ('bowl-2026-boca-raton','Boca Raton Bowl','2026-12-18 11:00:00-05',3),
 ('bowl-2026-gasparilla','Gasparilla Bowl','2026-12-18 14:30:00-05',4),
 ('bowl-2026-myrtle-beach','Myrtle Beach Bowl','2026-12-21 11:00:00-05',5),
 ('bowl-2026-idaho-potato','Idaho Potato Bowl','2026-12-21 14:30:00-05',6),
 ('bowl-2026-puerto-rico','Puerto Rico Bowl','2026-12-22 13:30:00-05',7),
 ('bowl-2026-cure','Cure Bowl','2026-12-22 17:00:00-05',8),
 ('bowl-2026-independence','Independence Bowl','2026-12-22 20:30:00-05',9),
 ('bowl-2026-new-orleans','New Orleans Bowl','2026-12-23 14:00:00-05',10),
 ('bowl-2026-armed-forces','Armed Forces Bowl','2026-12-23 17:30:00-05',11),
 ('bowl-2026-frisco','Frisco Bowl','2026-12-23 21:00:00-05',12),
 ('bowl-2026-new-mexico','New Mexico Bowl','2026-12-24 14:30:00-05',13),
 ('bowl-2026-hawaii','Hawaii Bowl','2026-12-24 19:00:00-05',14),
 ('bowl-2026-pinstripe','Pinstripe Bowl','2026-12-26 12:00:00-05',15),
 ('bowl-2026-fenway','Fenway Bowl','2026-12-26 14:00:00-05',16),
 ('bowl-2026-dukes-mayo','Duke''s Mayo Bowl','2026-12-26 15:30:00-05',17),
 ('bowl-2026-68-ventures','68 Ventures Bowl','2026-12-26 17:30:00-05',18),
 ('bowl-2026-cactus','Cactus Bowl','2026-12-26 19:30:00-05',19),
 ('bowl-2026-military','Military Bowl','2026-12-28 14:00:00-05',20),
 ('bowl-2026-birmingham','Birmingham Bowl','2026-12-29 14:00:00-05',21),
 ('bowl-2026-pop-tarts','Pop-Tarts Bowl','2026-12-29 17:30:00-05',22),
 ('bowl-2026-alamo','Alamo Bowl','2026-12-29 21:00:00-05',23),
 ('bowl-2026-gator','Gator Bowl','2026-12-30 11:30:00-05',24),
 ('bowl-2026-music-city','Music City Bowl','2026-12-30 15:00:00-05',25),
 ('bowl-2026-reliaquest','ReliaQuest Bowl','2026-12-31 12:00:00-05',26),
 ('bowl-2026-las-vegas','Las Vegas Bowl','2026-12-31 15:45:00-05',27),
 ('bowl-2026-texas','Texas Bowl','2026-12-31 19:30:00-05',28),
 ('bowl-2027-citrus','Citrus Bowl','2027-01-02 12:00:00-05',29),
 ('bowl-2027-first-responder','First Responder Bowl','2027-01-02 15:30:00-05',30),
 ('bowl-2027-liberty','Liberty Bowl','2027-01-02 19:30:00-05',31)
)
insert into public.bowl_pool_games (season_id, provider_game_id, bowl_name, kickoff_at, line_lock_at, order_index, status)
select season.id, rows.provider_game_id, rows.bowl_name, rows.kickoff_at::timestamptz, rows.kickoff_at::timestamptz, rows.order_index, 'scheduled'
from season cross join rows
on conflict (provider_game_id) do update set bowl_name = excluded.bowl_name, kickoff_at = excluded.kickoff_at, line_lock_at = excluded.line_lock_at, order_index = excluded.order_index;
