-- Expose one coarse, Commissioner-only capacity measurement. The function
-- returns a number only; it cannot inspect application rows or user data.
create or replace function public.project_database_usage_bytes()
returns bigint
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select pg_database_size(current_database());
$$;

revoke all on function public.project_database_usage_bytes() from public, anon, authenticated;
grant execute on function public.project_database_usage_bytes() to service_role;
