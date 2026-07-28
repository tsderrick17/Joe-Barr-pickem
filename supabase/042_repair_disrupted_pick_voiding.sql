-- Repair the Survivor update join in 040. PostgreSQL does not permit the
-- target table alias inside a nested JOIN condition in UPDATE ... FROM.

create or replace function public.void_disrupted_picks()
returns table(ats_voided integer, survivor_voided integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  ats_count integer := 0;
  survivor_count integer := 0;
begin
  with voided as (
    update public.picks p set result = 'void'
    from public.games g, public.scoring_periods sp
    where p.game_id = g.id and g.scoring_period_id = sp.id
      and p.result = 'pending' and g.status in ('postponed', 'cancelled')
      and sp.status <> 'complete'
    returning p.id, p.player_id, p.scoring_period_id, p.game_id, g.status as game_status
  ), audited as (
    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    select player_id, 'ats_pick_voided', 'pick', id,
      jsonb_build_object('scoring_mode', 'against_spread', 'game_id', game_id, 'reason', game_status)
    from voided returning 1
  ) select count(*) into ats_count from audited;

  with voided as (
    update public.survivor_picks p set result = 'void'
    from public.games g, public.scoring_periods sp, public.survivor_entries se
    where p.game_id = g.id and g.scoring_period_id = sp.id and se.id = p.survivor_entry_id
      and p.result = 'pending' and g.status in ('postponed', 'cancelled')
      and sp.status <> 'complete'
    returning p.id, se.player_id, p.scoring_period_id, p.game_id, p.selected_team_id, g.status as game_status
  ), audited as (
    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    select player_id, 'survivor_pick_voided', 'survivor_pick', id,
      jsonb_build_object('scoring_mode', 'straight_up', 'spread_applied', false, 'game_id', game_id,
        'selected_team_id', selected_team_id, 'reason', game_status)
    from voided returning 1
  ) select count(*) into survivor_count from audited;

  return query select ats_count, survivor_count;
end;
$$;
