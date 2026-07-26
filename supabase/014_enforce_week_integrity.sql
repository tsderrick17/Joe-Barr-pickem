create or replace function public.freeze_assigned_scoring_period_dates()
returns trigger
language plpgsql
as $$
begin
  if old.starts_at is not null
    and new.starts_at is distinct from old.starts_at then
    raise exception
      'A scoring period start date cannot be changed after it is assigned.';
  end if;

  if old.ends_at is not null
    and new.ends_at is distinct from old.ends_at then
    raise exception
      'A scoring period end date cannot be changed after it is assigned.';
  end if;

  return new;
end;
$$;

drop trigger if exists freeze_assigned_scoring_period_dates
  on public.scoring_periods;

create trigger freeze_assigned_scoring_period_dates
before update of starts_at, ends_at
on public.scoring_periods
for each row
execute function public.freeze_assigned_scoring_period_dates();


create or replace function public.enforce_game_week_window()
returns trigger
language plpgsql
as $$
declare
  period_start timestamptz;
  period_end timestamptz;
begin
  select starts_at, ends_at
  into period_start, period_end
  from public.scoring_periods
  where id = new.scoring_period_id;

  if period_start is not null and new.kickoff_at < period_start then
    raise exception
      'Game kickoff is before the assigned scoring period.';
  end if;

  if period_end is not null and new.kickoff_at >= period_end then
    raise exception
      'Game kickoff is after the assigned scoring period.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_game_week_window
  on public.games;

create trigger enforce_game_week_window
before insert or update of scoring_period_id, kickoff_at
on public.games
for each row
execute function public.enforce_game_week_window();


create or replace function public.prevent_game_week_reassignment()
returns trigger
language plpgsql
as $$
begin
  if new.scoring_period_id is distinct from old.scoring_period_id then
    raise exception
      'A saved game cannot be moved to a different scoring period.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_game_week_reassignment
  on public.games;

create trigger prevent_game_week_reassignment
before update of scoring_period_id
on public.games
for each row
execute function public.prevent_game_week_reassignment();