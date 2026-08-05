-- PostgreSQL has no max(uuid), so choose the only active player's UUID from
-- a deterministically ordered array when Survivor reaches one entry.

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
    (array_agg(player_id order by player_id) filter (where status = 'active'))[1]
    into remaining_entry_count, active_entry_count, winning_player_id
  from public.survivor_entries
  where season_id = target_season_id;

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
