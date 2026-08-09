-- The reschedule RPC returns a table with a game_id output column. Qualify the
-- game_lines lookup so PostgreSQL never mistakes that output variable for the
-- table column when a rescheduled game already has a locked line.
do $$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.reschedule_game_atomically(uuid,timestamptz,timestamptz,uuid)'::regprocedure
  ) into definition;

  patched := replace(
    definition,
    'from public.game_lines where game_id = target_game_id',
    'from public.game_lines as existing_line where existing_line.game_id = target_game_id'
  );

  if patched = definition then
    raise exception 'The rescheduled-game line lookup could not be patched safely.';
  end if;

  execute patched;
end;
$$;
