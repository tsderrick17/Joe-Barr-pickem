-- The eligibility implementation inserts snapshots and its after-insert
-- trigger atomically voids ineligible future picks. PostgreSQL statements do
-- not see sibling data-modifying CTE writes through the base table, however,
-- so the original function returned zero counters on the first call even
-- though the rows and voids were correct. Keep that mutation transaction and
-- report its durable results from a wrapper statement afterward.

alter function public.snapshot_playoff_day_eligibility(uuid, timestamptz)
  rename to snapshot_playoff_day_eligibility_implementation;

create or replace function public.snapshot_playoff_day_eligibility(
  target_scoring_period_id uuid,
  evaluated_at timestamptz default clock_timestamp()
)
returns table(
  snapshot_day date,
  players_eligible integer,
  players_eliminated integer,
  picks_scratched integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  implementation_result record;
  eligible_count integer := 0;
  eliminated_count integer := 0;
  scratched_count integer := 0;
begin
  select * into implementation_result
  from public.snapshot_playoff_day_eligibility_implementation(
    target_scoring_period_id,
    evaluated_at
  );

  if implementation_result.snapshot_day is null then
    return query select null::date, 0, 0, 0;
    return;
  end if;

  select
    count(*) filter (where eligibility.is_eligible)::integer,
    count(*) filter (where not eligibility.is_eligible)::integer
  into eligible_count, eliminated_count
  from public.playoff_day_eligibility eligibility
  where eligibility.scoring_period_id = target_scoring_period_id
    and eligibility.game_day = implementation_result.snapshot_day;

  select count(*)::integer into scratched_count
  from public.audit_logs audit
  where audit.action = 'playoff_pick_scratched'
    and audit.details ->> 'scoring_period_id' = target_scoring_period_id::text
    and audit.details ->> 'effective_game_day' = implementation_result.snapshot_day::text;

  return query select implementation_result.snapshot_day,
    eligible_count, eliminated_count, scratched_count;
end;
$$;

revoke all on function public.snapshot_playoff_day_eligibility_implementation(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.snapshot_playoff_day_eligibility(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.snapshot_playoff_day_eligibility(uuid, timestamptz)
  to service_role;
