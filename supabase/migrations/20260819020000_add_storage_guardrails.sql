-- Storage guardrails deliberately leave competitive history, official lines,
-- audit records, and email receipts untouched. Only routine machine records
-- that no longer help live operations expire.

create index if not exists spread_history_duplicate_guard_idx
  on public.spread_history(game_id, favorite_team_id, spread, source, captured_at desc);

create or replace function public.skip_duplicate_preliminary_spread_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  eastern_day_start timestamptz;
begin
  eastern_day_start := date_trunc('day', new.captured_at at time zone 'America/New_York') at time zone 'America/New_York';

  if exists (
    select 1
    from public.spread_history as existing
    where existing.game_id = new.game_id
      and existing.favorite_team_id is not distinct from new.favorite_team_id
      and existing.spread = new.spread
      and existing.source = new.source
      and existing.captured_at >= eastern_day_start
      and existing.captured_at < eastern_day_start + interval '1 day'
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists spread_history_skip_duplicate_snapshot on public.spread_history;
create trigger spread_history_skip_duplicate_snapshot
before insert on public.spread_history
for each row execute function public.skip_duplicate_preliminary_spread_snapshot();

create or replace function public.storage_table_usage()
returns table(
  relation_name text,
  total_bytes bigint,
  table_bytes bigint,
  index_bytes bigint,
  estimated_rows bigint
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    class.relname::text as relation_name,
    pg_catalog.pg_total_relation_size(class.oid)::bigint as total_bytes,
    pg_catalog.pg_relation_size(class.oid)::bigint as table_bytes,
    pg_catalog.pg_indexes_size(class.oid)::bigint as index_bytes,
    coalesce(stat.n_live_tup, 0)::bigint as estimated_rows
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  left join pg_catalog.pg_stat_user_tables as stat on stat.relid = class.oid
  where namespace.nspname = 'public'
    and class.relkind = 'r'
  order by pg_catalog.pg_total_relation_size(class.oid) desc, class.relname;
$$;

create or replace function public.prune_operational_storage(
  reference_time timestamptz default clock_timestamp()
)
returns table(record_type text, deleted_count bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  retention_cutoff timestamptz := reference_time - interval '180 days';
  sync_runs_deleted bigint := 0;
  resolved_alerts_deleted bigint := 0;
  resolved_reviews_deleted bigint := 0;
begin
  delete from public.sync_runs
  where started_at < retention_cutoff;
  get diagnostics sync_runs_deleted = row_count;

  delete from public.automation_alerts
  where resolved_at is not null and resolved_at < retention_cutoff;
  get diagnostics resolved_alerts_deleted = row_count;

  delete from public.schedule_change_reviews
  where resolved_at is not null and resolved_at < retention_cutoff;
  get diagnostics resolved_reviews_deleted = row_count;

  return query values
    ('sync_runs', sync_runs_deleted),
    ('resolved_automation_alerts', resolved_alerts_deleted),
    ('resolved_schedule_change_reviews', resolved_reviews_deleted);
end;
$$;

-- Run off-hours once each week. This uses database-local time and does not
-- call a paid provider or require an application secret.
select cron.unschedule(jobid)
from cron.job
where jobname = 'prune-pickem-operational-storage-weekly';

select cron.schedule(
  'prune-pickem-operational-storage-weekly',
  '17 13 * * 1',
  $$ select public.prune_operational_storage(); $$
);

revoke all on function public.skip_duplicate_preliminary_spread_snapshot() from public, anon, authenticated;
revoke all on function public.storage_table_usage() from public, anon, authenticated;
revoke all on function public.prune_operational_storage(timestamptz) from public, anon, authenticated;
grant execute on function public.storage_table_usage() to service_role;
grant execute on function public.prune_operational_storage(timestamptz) to service_role;
