insert into public.seasons (year, state)
values (2026, 'preseason')
on conflict (year)
do update set state = excluded.state;

insert into public.scoring_periods (
  season_id,
  display_name,
  period_type,
  max_picks,
  status,
  display_order
)
select
  seasons.id,
  'Week ' || week_number,
  'regular',
  2,
  'upcoming',
  week_number
from public.seasons
cross join generate_series(1, 18) as week_number
where seasons.year = 2026
on conflict (season_id, display_order)
do update set
  display_name = excluded.display_name,
  period_type = excluded.period_type,
  max_picks = excluded.max_picks,
  status = excluded.status;

insert into public.scoring_periods (
  season_id,
  display_name,
  period_type,
  max_picks,
  status,
  display_order
)
select
  seasons.id,
  playoff_round.display_name,
  'playoff',
  playoff_round.max_picks,
  'upcoming',
  playoff_round.display_order
from public.seasons
cross join (
  values
    ('Wild Card', 6, 19),
    ('Divisional Round', 4, 20),
    ('Conference Championships', 2, 21),
    ('Super Bowl', 1, 22)
) as playoff_round(display_name, max_picks, display_order)
where seasons.year = 2026
on conflict (season_id, display_order)
do update set
  display_name = excluded.display_name,
  period_type = excluded.period_type,
  max_picks = excluded.max_picks,
  status = excluded.status;