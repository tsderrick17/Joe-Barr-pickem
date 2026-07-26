alter table public.scoring_periods
add column if not exists starts_at timestamptz,
add column if not exists ends_at timestamptz;

create index if not exists scoring_periods_dates_index
on public.scoring_periods (season_id, starts_at, ends_at);