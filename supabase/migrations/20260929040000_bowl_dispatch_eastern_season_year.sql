-- The Bowl dispatcher chose its season year from the UTC month, while the
-- application (seasonYearAt) turns the season over at 12:00 AM Eastern on
-- August 1. For about four hours each July 31 evening the two disagreed and the
-- dispatcher created next season's Bowl row early. Use Eastern time, matching
-- the application. Behavior is otherwise unchanged.

create or replace function public.dispatch_bowl_sync_if_due()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, net, vault
as $$
declare
  season_year_value integer := extract(year from (clock_timestamp() at time zone 'America/New_York'))::integer;
  season_month integer := extract(month from (clock_timestamp() at time zone 'America/New_York'))::integer;
  season_row public.bowl_pool_seasons%rowtype;
  has_active_games boolean := false;
  min_interval interval;
  shared_secret text;
  request_id bigint;
  evaluated_at timestamptz := clock_timestamp();
begin
  if season_month < 8 then season_year_value := season_year_value - 1; end if;
  if not pg_try_advisory_xact_lock(7026, 928) then return false; end if;

  insert into public.bowl_pool_seasons (season_year, player_visible_at)
  values (season_year_value, make_timestamptz(season_year_value, 12, 7, 8, 0, 0, 'UTC'))
  on conflict (season_year) do nothing;

  select * into season_row from public.bowl_pool_seasons
  where season_year = season_year_value for update;
  select exists (
    select 1 from public.bowl_pool_games
    where season_id = season_row.id and status in ('scheduled', 'live')
  ) into has_active_games;

  if season_row.status = 'complete' or season_row.first_kickoff_at is null then
    min_interval := interval '24 hours';
  elsif season_row.first_kickoff_at > evaluated_at then
    min_interval := case
      when season_row.first_kickoff_at <= evaluated_at + interval '30 days' then interval '1 hour'
      else interval '24 hours'
    end;
  elsif has_active_games then
    min_interval := interval '15 minutes';
  else
    min_interval := interval '24 hours';
  end if;

  if season_row.last_sync_dispatched_at is not null
    and season_row.last_sync_dispatched_at > evaluated_at - min_interval then
    return false;
  end if;

  select decrypted_secret into shared_secret
  from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if coalesce(shared_secret, '') = '' then raise exception 'The automation secret is missing.'; end if;
  request_id := net.http_post(
    url := 'https://pickemjb.vercel.app/api/cron/sync-bowl-scores',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || shared_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  if request_id is null then return false; end if;
  update public.bowl_pool_seasons set last_sync_dispatched_at = evaluated_at where id = season_row.id;
  return true;
end;
$$;

revoke all on function public.dispatch_bowl_sync_if_due() from public, anon, authenticated;
grant execute on function public.dispatch_bowl_sync_if_due() to service_role;
