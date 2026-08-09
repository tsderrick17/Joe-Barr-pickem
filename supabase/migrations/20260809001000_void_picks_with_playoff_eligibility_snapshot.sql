-- A data-modifying CTE cannot see rows inserted by a sibling CTE in the same
-- statement. The original eligibility snapshot therefore recorded an
-- eliminated player correctly, but could leave that player's future picks
-- pending until the snapshot function was called a second time.
--
-- Enforce the scratch at the table boundary so recording the immutable
-- day-start snapshot and voiding the affected playoff picks are atomic.

create or replace function public.void_picks_for_ineligible_playoff_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  voided_pick record;
begin
  if new.is_eligible then
    return new;
  end if;

  for voided_pick in
    update public.picks as pick
    set result = 'void'
    from public.games as game,
      public.scoring_periods as period
    where pick.player_id = new.player_id
      and pick.result = 'pending'
      and game.id = pick.game_id
      and period.id = game.scoring_period_id
      and period.season_id = new.season_id
      and period.period_type = 'playoff'
      and (game.kickoff_at at time zone 'America/New_York')::date >= new.game_day
    returning pick.id, pick.player_id, pick.game_id
  loop
    insert into public.audit_logs (
      actor_player_id,
      action,
      entity_type,
      entity_id,
      details
    ) values (
      null,
      'playoff_pick_scratched',
      'pick',
      voided_pick.id,
      jsonb_build_object(
        'player_id', voided_pick.player_id,
        'game_id', voided_pick.game_id,
        'scoring_period_id', new.scoring_period_id,
        'effective_game_day', new.game_day,
        'reason', 'Player was mathematically eliminated before this playoff game day began.'
      )
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.void_picks_for_ineligible_playoff_snapshot()
  from public, anon, authenticated;

drop trigger if exists void_picks_for_ineligible_playoff_snapshot
  on public.playoff_day_eligibility;

create trigger void_picks_for_ineligible_playoff_snapshot
after insert on public.playoff_day_eligibility
for each row
execute function public.void_picks_for_ineligible_playoff_snapshot();
