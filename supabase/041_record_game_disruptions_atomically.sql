-- Commissioner-recorded postponements/cancellations are deliberate, auditable
-- state transitions. They immediately invoke the void policy from migration 040.

create or replace function public.record_game_disruption(
  target_game_id uuid,
  disruption_status text,
  actor_player_id uuid
)
returns table(ats_voided integer, survivor_voided integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_status text;
  period_status text;
begin
  if disruption_status not in ('postponed', 'cancelled') then
    raise exception 'A disruption must be recorded as postponed or cancelled.';
  end if;

  select g.status, sp.status into previous_status, period_status
  from public.games g
  join public.scoring_periods sp on sp.id = g.scoring_period_id
  where g.id = target_game_id
  for update;

  if previous_status is null then raise exception 'The selected game does not exist.'; end if;
  if period_status = 'complete' then raise exception 'A completed scoring period is read-only.'; end if;
  if previous_status = 'final' then raise exception 'A final game cannot be marked as disrupted.'; end if;
  if previous_status in ('postponed', 'cancelled') then
    raise exception 'This game has already been recorded as %.', previous_status;
  end if;

  update public.games set status = disruption_status where id = target_game_id;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (actor_player_id, 'game_disruption_recorded', 'game', target_game_id,
    jsonb_build_object('previous_status', previous_status, 'status', disruption_status));

  return query select * from public.void_disrupted_picks();
end;
$$;

revoke all on function public.void_disrupted_picks() from public;
grant execute on function public.void_disrupted_picks() to service_role;
revoke all on function public.record_game_disruption(uuid, text, uuid) from public;
grant execute on function public.record_game_disruption(uuid, text, uuid) to service_role;
