-- A browser can lose the response after the database commit.  Keep a durable
-- receipt for each logical save so a safe client retry is a no-op.
create table if not exists public.pick_submission_receipts (
  request_id uuid primary key,
  player_id uuid not null references public.players(id),
  scoring_period_id uuid not null references public.scoring_periods(id),
  created_at timestamptz not null default now()
);

alter table public.pick_submission_receipts enable row level security;

create or replace function public.save_slate_selections(
  target_player_id uuid,
  target_survivor_entry_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb,
  replacement_survivor_pick jsonb,
  request_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if request_id is null then
    raise exception 'A submission receipt is required.';
  end if;

  insert into public.pick_submission_receipts(request_id, player_id, scoring_period_id)
  values (request_id, target_player_id, target_scoring_period_id)
  on conflict (request_id) do nothing;

  if not found then
    return;
  end if;

  perform 1
  from public.survivor_entries
  where id = target_survivor_entry_id
    and player_id = target_player_id;
  if not found then
    raise exception 'The Survivor entry does not belong to this player.';
  end if;

  perform public.replace_unlocked_picks(target_player_id, target_scoring_period_id, replacement_picks);
  perform public.replace_unlocked_survivor_pick(target_survivor_entry_id, target_scoring_period_id, replacement_survivor_pick);

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (
    target_player_id,
    'slate_selections_saved',
    'scoring_period',
    target_scoring_period_id,
    jsonb_build_object(
      'ats_pick_count', jsonb_array_length(replacement_picks),
      'survivor_pick_saved', replacement_survivor_pick is not null,
      'request_id', request_id
    )
  );
end;
$$;

-- Preserve the existing service-role contract for maintenance scripts.
create or replace function public.save_slate_selections(
  target_player_id uuid,
  target_survivor_entry_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb,
  replacement_survivor_pick jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.save_slate_selections(
    target_player_id, target_survivor_entry_id, target_scoring_period_id,
    replacement_picks, replacement_survivor_pick, gen_random_uuid()
  );
end;
$$;

revoke all on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb, uuid) to service_role;
grant execute on function public.save_slate_selections(uuid, uuid, uuid, jsonb, jsonb) to service_role;
