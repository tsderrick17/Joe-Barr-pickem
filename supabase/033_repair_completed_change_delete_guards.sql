-- PostgreSQL BEFORE DELETE triggers must return OLD to permit the delete.
-- Returning NEW (which is null during DELETE) silently cancels allowed
-- deletions, preventing atomic pick and line replacement.

create or replace function public.prevent_completed_game_changes()
returns trigger
language plpgsql
as $$
declare
  period_id uuid;
begin
  period_id := case when tg_op = 'DELETE' then old.scoring_period_id else new.scoring_period_id end;
  if exists (select 1 from public.scoring_periods where id = period_id and status = 'complete') and (tg_op in ('INSERT', 'DELETE') or new is distinct from old) then
    raise exception 'Games in a completed scoring period are rubber-stamped and cannot be changed.';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_completed_pick_changes()
returns trigger
language plpgsql
as $$
declare
  period_id uuid;
begin
  period_id := case when tg_op = 'DELETE' then old.scoring_period_id else new.scoring_period_id end;
  if exists (select 1 from public.scoring_periods where id = period_id and status = 'complete') and (tg_op in ('INSERT', 'DELETE') or new is distinct from old) then
    raise exception 'Picks in a completed scoring period are rubber-stamped and cannot be changed.';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_completed_line_changes()
returns trigger
language plpgsql
as $$
declare
  target_game_id uuid;
begin
  target_game_id := case when tg_op = 'DELETE' then old.game_id else new.game_id end;
  if exists (select 1 from public.games join public.scoring_periods on scoring_periods.id = games.scoring_period_id where games.id = target_game_id and scoring_periods.status = 'complete') and (tg_op in ('INSERT', 'DELETE') or new is distinct from old) then
    raise exception 'Official lines in a completed scoring period are rubber-stamped and cannot be changed.';
  end if;
  return coalesce(new, old);
end;
$$;
