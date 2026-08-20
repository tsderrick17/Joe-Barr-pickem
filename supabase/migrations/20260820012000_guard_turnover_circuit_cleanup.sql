-- Production rejects unqualified DELETE statements. Preserve the certified
-- turnover function exactly as migrated, while making its intentional
-- one-time circuit reset explicit and reproducible on fresh installations.

do $migration$
declare
  function_definition text;
  unsafe_statement constant text := 'delete from public.provider_failure_circuits;';
  guarded_statement constant text := 'delete from public.provider_failure_circuits where true;';
begin
  select pg_get_functiondef(
    'public.perform_annual_season_turnover(timestamptz)'::regprocedure
  ) into function_definition;

  if position(guarded_statement in function_definition) > 0 then
    return;
  end if;

  if position(unsafe_statement in function_definition) = 0 then
    raise exception 'The certified turnover cleanup definition was not recognized.';
  end if;

  execute replace(function_definition, unsafe_statement, guarded_statement);
end;
$migration$;
