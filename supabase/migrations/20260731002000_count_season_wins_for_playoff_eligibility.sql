-- The playoff race is a season-long race. Amend the immutable day-snapshot
-- function so its lead includes every earlier ATS win in this season, while
-- the remaining possible wins remain playoff-only. This is a replace-in-place
-- migration because the first version may already have reached production.

do $$
declare
  function_definition text;
  patched_definition text;
begin
  select pg_get_functiondef(
    'public.snapshot_playoff_day_eligibility(uuid,timestamptz)'::regprocedure
  ) into function_definition;

  patched_definition := regexp_replace(
    function_definition,
    'left join public[.]games as game on game[.]id = pick[.]game_id[[:space:]]+left join relevant_periods as period on period[.]id = game[.]scoring_period_id',
    $replacement$left join public.games as game on game.id = pick.game_id
    left join public.scoring_periods as pick_period
      on pick_period.id = game.scoring_period_id
      and pick_period.season_id = target_period.season_id
    left join relevant_periods as period on period.id = game.scoring_period_id$replacement$
  );
  patched_definition := replace(
    patched_definition,
    'and period.id is not null',
    'and pick_period.id is not null'
  );

  if patched_definition = function_definition
    or position('pick_period.id is not null' in patched_definition) = 0 then
    raise exception 'The playoff eligibility season-total correction could not be applied safely.';
  end if;

  execute patched_definition;
end;
$$;
