-- A new pool year needs a fresh schedule template, not a copy of player or
-- game data. The dates remain empty until the protected schedule importer
-- assigns them from the new NFL schedule.
create or replace function public.ensure_annual_season_rollover(
  evaluated_at timestamptz default clock_timestamp()
)
returns table(season_id uuid, season_year integer, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  target_year integer := extract(year from evaluated_at at time zone 'America/New_York')::integer;
  target_month integer := extract(month from evaluated_at at time zone 'America/New_York')::integer;
  existing_id uuid;
  template_year integer;
  template_count integer;
  periods_created integer := 0;
begin
  if target_month < 8 then
    target_year := target_year - 1;
  end if;

  template_year := target_year - 1;
  perform pg_advisory_xact_lock(hashtext('annual-season-rollover'));

  select id into existing_id from public.seasons where year = target_year;
  if existing_id is null then
    select count(*) into template_count
    from public.scoring_periods period
    join public.seasons season on season.id = period.season_id
    where season.year = template_year;

    if template_count = 0 then
      raise exception 'Cannot create season % without scoring-period template from season %.', target_year, template_year;
    end if;

    insert into public.seasons(year, state) values (target_year, 'preseason')
    returning id into existing_id;

    insert into public.scoring_periods (
      season_id, display_name, period_type, max_picks, status, display_order,
      starts_at, ends_at
    )
    select
      existing_id, period.display_name, period.period_type, period.max_picks,
      'upcoming', period.display_order, null, null
    from public.scoring_periods period
    join public.seasons season on season.id = period.season_id
    where season.year = template_year
    order by period.display_order;
    get diagnostics periods_created = row_count;

    insert into public.audit_logs(action, entity_type, entity_id, details)
    values (
      'season_created', 'season', existing_id,
      jsonb_build_object(
        'year', target_year,
        'automatic', true,
        'template_year', template_year,
        'scoring_periods_created', periods_created
      )
    );
    return query select existing_id, target_year, true;
  end if;

  -- Repair only a previously interrupted *new-season* setup. Existing periods
  -- win; dates, games, picks, results, and historical seasons are untouched.
  insert into public.scoring_periods (
    season_id, display_name, period_type, max_picks, status, display_order,
    starts_at, ends_at
  )
  select
    existing_id, period.display_name, period.period_type, period.max_picks,
    'upcoming', period.display_order, null, null
  from public.scoring_periods period
  join public.seasons season on season.id = period.season_id
  where season.year = template_year
  on conflict (season_id, display_order) do nothing;

  return query select existing_id, target_year, false;
end;
$$;

revoke all on function public.ensure_annual_season_rollover(timestamptz) from public, anon, authenticated;
grant execute on function public.ensure_annual_season_rollover(timestamptz) to service_role;
