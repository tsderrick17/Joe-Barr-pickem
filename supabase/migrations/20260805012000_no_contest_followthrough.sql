-- A declared no contest is settled, never a remaining opportunity. Patch the
-- already-deployed integrity functions in place so the same policy holds for
-- playoff-day eligibility, Survivor no-pick checks, and score imports.

do $$
declare
  function_definition text;
  patched_definition text;
begin
  select pg_get_functiondef(
    'public.snapshot_playoff_day_eligibility(uuid,timestamptz)'::regprocedure
  ) into function_definition;

  patched_definition := replace(
    function_definition,
    'game.status not in (''cancelled'', ''postponed'')',
    'game.status not in (''cancelled'', ''postponed'', ''no_contest'')'
  );

  if patched_definition = function_definition then
    raise exception 'The playoff-day eligibility no-contest policy could not be applied safely.';
  end if;

  execute patched_definition;
end;
$$;

do $$
declare
  function_definition text;
  patched_definition text;
begin
  select pg_get_functiondef(
    'public.eliminate_survivor_no_picks(timestamptz)'::regprocedure
  ) into function_definition;

  patched_definition := replace(
    function_definition,
    'game.status not in (''postponed'', ''cancelled'')',
    'game.status not in (''postponed'', ''cancelled'', ''no_contest'')'
  );

  if patched_definition = function_definition then
    raise exception 'The Survivor no-pick no-contest policy could not be applied safely.';
  end if;

  execute patched_definition;
end;
$$;

do $$
declare
  function_definition text;
  patched_definition text;
begin
  select pg_get_functiondef(
    'public.finalize_games_atomically(jsonb,timestamptz)'::regprocedure
  ) into function_definition;

  patched_definition := replace(
    function_definition,
    'target_game.status in (''postponed'', ''cancelled'')',
    'target_game.status in (''postponed'', ''cancelled'', ''no_contest'')'
  );
  patched_definition := replace(
    patched_definition,
    'A postponed or cancelled game cannot be finalized automatically.',
    'A postponed, cancelled, or no-contest game cannot be finalized automatically.'
  );

  if patched_definition = function_definition then
    raise exception 'The final-score no-contest policy could not be applied safely.';
  end if;

  execute patched_definition;
end;
$$;
