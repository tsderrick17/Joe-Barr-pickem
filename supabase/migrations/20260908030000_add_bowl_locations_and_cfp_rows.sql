alter table public.bowl_pool_games add column if not exists time_confirmed boolean not null default true;

with season as (select id from public.bowl_pool_seasons where season_year = 2026), rows(provider_game_id,bowl_name,kickoff_at,order_index,venue_city,venue_state,time_confirmed) as (values
 ('cfp-2026-fiesta-quarterfinal','Fiesta Bowl (CFP Quarterfinal)','2026-12-30 12:00:00-05',32,'Glendale','AZ',false),
 ('cfp-2027-cotton-quarterfinal','Cotton Bowl Classic (CFP Quarterfinal)','2027-01-01 12:00:00-05',33,'Arlington','TX',false),
 ('cfp-2027-peach-quarterfinal','Peach Bowl (CFP Quarterfinal)','2027-01-01 12:00:00-05',34,'Atlanta','GA',false),
 ('cfp-2027-rose-quarterfinal','Rose Bowl (CFP Quarterfinal)','2027-01-01 12:00:00-05',35,'Pasadena','CA',false),
 ('cfp-2027-orange-semifinal','Orange Bowl (CFP Semifinal)','2027-01-14 19:30:00-05',36,'Miami Gardens','FL',true),
 ('cfp-2027-sugar-semifinal','Sugar Bowl (CFP Semifinal)','2027-01-15 19:30:00-05',37,'New Orleans','LA',true),
 ('cfp-2027-national-championship','National Championship (CFP)','2027-01-25 19:30:00-05',38,'Las Vegas','NV',true)
)
insert into public.bowl_pool_games (season_id,provider_game_id,bowl_name,kickoff_at,line_lock_at,order_index,venue_city,venue_state,time_confirmed,status)
select season.id, rows.provider_game_id, rows.bowl_name, rows.kickoff_at::timestamptz, rows.kickoff_at::timestamptz, rows.order_index, rows.venue_city, rows.venue_state, rows.time_confirmed, 'scheduled' from season cross join rows
on conflict (provider_game_id) do update set bowl_name=excluded.bowl_name,kickoff_at=excluded.kickoff_at,line_lock_at=excluded.line_lock_at,order_index=excluded.order_index,venue_city=excluded.venue_city,venue_state=excluded.venue_state,time_confirmed=excluded.time_confirmed;
