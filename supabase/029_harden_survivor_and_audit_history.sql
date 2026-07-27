-- Audit history is append-only. Corrections should be represented by a new
-- audit event rather than rewriting or deleting the original record.
create or replace function public.prevent_audit_log_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit history is append-only and cannot be changed.';
end;
$$;

drop trigger if exists prevent_audit_log_changes on public.audit_logs;

create trigger prevent_audit_log_changes
before update or delete on public.audit_logs
for each row
execute function public.prevent_audit_log_changes();

-- Survivor selections receive the same completed-week protection as ATS picks.
create or replace function public.prevent_completed_survivor_pick_changes()
returns trigger
language plpgsql
as $$
declare
  period_id uuid;
begin
  period_id := case
    when tg_op = 'DELETE' then old.scoring_period_id
    else new.scoring_period_id
  end;

  if exists (
    select 1
    from public.scoring_periods
    where id = period_id
      and status = 'complete'
  ) and (tg_op in ('INSERT', 'DELETE') or new is distinct from old) then
    raise exception 'Survivor picks in a completed scoring period are rubber-stamped and cannot be changed.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists prevent_completed_survivor_pick_changes
  on public.survivor_picks;

create trigger prevent_completed_survivor_pick_changes
before insert or update or delete on public.survivor_picks
for each row
execute function public.prevent_completed_survivor_pick_changes();

-- An eliminated or completed entry cannot be silently reactivated. A manual
-- correction requires an explicit database migration and leaves deploy history.
create or replace function public.prevent_survivor_entry_reactivation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('eliminated', 'complete') and new.status is distinct from old.status then
    raise exception 'A finalized Survivor entry cannot be reactivated or rewritten.';
  end if;

  if old.eliminated_at is not null and (
    new.eliminated_at is distinct from old.eliminated_at
    or new.eliminated_scoring_period_id is distinct from old.eliminated_scoring_period_id
    or new.eliminated_game_id is distinct from old.eliminated_game_id
  ) then
    raise exception 'Survivor elimination history cannot be rewritten.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_survivor_entry_reactivation
  on public.survivor_entries;

create trigger prevent_survivor_entry_reactivation
before update on public.survivor_entries
for each row
execute function public.prevent_survivor_entry_reactivation();
