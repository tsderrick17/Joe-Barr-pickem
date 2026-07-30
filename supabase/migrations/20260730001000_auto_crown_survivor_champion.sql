-- Survivor's trophy is a season record, not a hard-coded player name. Once
-- one eligible entry remains, crown that player exactly once and retain the
-- immutable audit receipt for future seasons.

alter table public.seasons
  add column if not exists survivor_champion_player_id uuid
    references public.players(id),
  add column if not exists survivor_champion_crowned_at timestamptz;

create or replace function public.refresh_survivor_champion(
  target_season_id uuid,
  evaluated_at timestamptz default clock_timestamp()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_champion_id uuid;
  remaining_entry_count integer;
  active_entry_count integer;
  winning_player_id uuid;
begin
  select survivor_champion_player_id
    into existing_champion_id
  from public.seasons
  where id = target_season_id
  for update;

  if not found then
    raise exception 'The Survivor season does not exist.';
  end if;

  if existing_champion_id is not null then
    return existing_champion_id;
  end if;

  select count(*), count(*) filter (where status = 'active'),
    max(player_id) filter (where status = 'active')
    into remaining_entry_count, active_entry_count, winning_player_id
  from public.survivor_entries
  where season_id = target_season_id;

  -- A one-player pool is not a championship. In every normal pool, the final
  -- active entry becomes champion immediately after the last elimination.
  if remaining_entry_count < 2 or active_entry_count <> 1 then
    return null;
  end if;

  update public.seasons
  set survivor_champion_player_id = winning_player_id,
      survivor_champion_crowned_at = evaluated_at
  where id = target_season_id
    and survivor_champion_player_id is null;

  if found then
    insert into public.audit_logs (
      actor_player_id,
      action,
      entity_type,
      entity_id,
      details
    ) values (
      null,
      'survivor_champion_crowned',
      'season',
      target_season_id,
      jsonb_build_object(
        'player_id', winning_player_id,
        'reason', 'Last active Survivor entry remaining.'
      )
    );
  end if;

  return winning_player_id;
end;
$$;

create or replace function public.refresh_survivor_champion_after_entry_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform public.refresh_survivor_champion(new.season_id, clock_timestamp());
  end if;

  return new;
end;
$$;

drop trigger if exists crown_survivor_champion_after_entry_change on public.survivor_entries;
create trigger crown_survivor_champion_after_entry_change
after update of status on public.survivor_entries
for each row
execute function public.refresh_survivor_champion_after_entry_change();

-- Covers a deployment made after a season has already narrowed to one entry.
select public.refresh_survivor_champion(id)
from public.seasons;

revoke all on function public.refresh_survivor_champion(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.refresh_survivor_champion_after_entry_change()
  from public, anon, authenticated;
grant execute on function public.refresh_survivor_champion(uuid, timestamptz)
  to service_role;
