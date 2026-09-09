-- Keep a durable audit trail for normal Bowl pick creation, changes, clears,
-- and grading, not only commissioner voids.
create or replace function public.audit_bowl_pool_pick_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor uuid; action_name text; detail jsonb;
begin
  select player_id into actor from bowl_pool_entries where id = coalesce(new.entry_id, old.entry_id);
  if tg_op = 'DELETE' then
    select player_id into actor from bowl_pool_entries where id = old.entry_id;
    insert into bowl_pool_pick_history(pick_id, entry_id, actor_player_id, action, details) values(old.id, old.entry_id, actor, 'cleared', jsonb_build_object('selected_team_id', old.selected_team_id));
    return old;
  elsif tg_op = 'INSERT' then action_name := 'created'; detail := jsonb_build_object('selected_team_id', new.selected_team_id);
  elsif new.result is distinct from old.result and new.result <> 'pending' then action_name := 'graded'; detail := jsonb_build_object('result', new.result);
  elsif new.selected_team_id is distinct from old.selected_team_id then action_name := 'changed'; detail := jsonb_build_object('from_team_id', old.selected_team_id, 'to_team_id', new.selected_team_id);
  else return new; end if;
  insert into bowl_pool_pick_history(pick_id, entry_id, actor_player_id, action, details) values(new.id, new.entry_id, actor, action_name, detail);
  return new;
end; $$;

drop trigger if exists audit_bowl_pool_pick_change on public.bowl_pool_picks;
create trigger audit_bowl_pool_pick_change after insert or delete or update of selected_team_id, result on public.bowl_pool_picks
for each row execute function public.audit_bowl_pool_pick_change();
