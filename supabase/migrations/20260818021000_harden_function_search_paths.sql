-- Supabase's security advisor correctly flags public-schema functions that
-- inherit a mutable search_path. Pin every existing public function that does
-- not already declare one. Existing functions that deliberately need cron or
-- vault already carry their own explicit path and are left unchanged.
do $$
declare
  target record;
begin
  for target in
    select procedure.oid::regprocedure as identity
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and not exists (
        select 1
        from unnest(coalesce(procedure.proconfig, array[]::text[])) as config(setting)
        where config.setting like 'search_path=%'
      )
  loop
    execute format('alter function %s set search_path = public', target.identity);
  end loop;
end
$$;

-- This helper is not part of the application contract. If it exists from a
-- prior dashboard/setup action, keep it server-only rather than leaving a
-- SECURITY DEFINER entry point callable by visitors or signed-in players.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
    execute 'grant execute on function public.rls_auto_enable() to service_role';
  end if;
end
$$;
