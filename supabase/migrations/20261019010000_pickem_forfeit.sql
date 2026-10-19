-- A player may forfeit the Pick'em playoffs once the first playoff round is open for picks.
--
-- Forfeiting is atomic and final for the player: it records one forfeit for the season, voids every
-- pick they have on a playoff game that has not started (excluded from totals, never graded as a
-- loss, the same treatment as a player who can no longer catch the leader), and from then on the
-- save path refuses any selection from them. Picks on games that have already kicked off stay on
-- their card and grade normally when those games finalize, so their score is final once the last
-- of them has graded. Every action is audited. Only the Commissioner can reverse a forfeit, through
-- reverse_pickem_forfeit; a reversal does not restore picks that were voided, it only lets the
-- player pick again for games that have not started.

create table if not exists public.pickem_forfeits (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  forfeited_at timestamptz not null default clock_timestamp(),
  picks_voided integer not null default 0 check (picks_voided >= 0),
  reversed_at timestamptz,
  reversed_by_player_id uuid references public.players(id) on delete set null
);

create unique index if not exists pickem_forfeits_one_active_idx
  on public.pickem_forfeits (season_id, player_id)
  where reversed_at is null;
create index if not exists pickem_forfeits_season_idx on public.pickem_forfeits (season_id);

alter table public.pickem_forfeits enable row level security;
revoke all on public.pickem_forfeits from public, anon, authenticated;
grant select, insert, update on public.pickem_forfeits to service_role;

create or replace function public.forfeit_pickem_season(
  target_player_id uuid,
  evaluated_at timestamptz default clock_timestamp()
)
returns table(forfeited_season_id uuid, voided_picks integer, was_already_forfeited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period public.scoring_periods%rowtype;
  forfeit_id uuid;
  voided integer := 0;
begin
  if evaluated_at is null or evaluated_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'The forfeit time is invalid.';
  end if;

  perform 1 from public.players where id = target_player_id and active for update;
  if not found then
    raise exception 'Only an active player can forfeit.';
  end if;

  -- The first open playoff round gates the whole feature; two forfeits can never overlap.
  select period.* into target_period
  from public.scoring_periods period
  join public.seasons season on season.id = period.season_id
  where period.period_type = 'playoff' and period.status = 'active'
  order by season.year desc, period.display_order
  limit 1
  for update of period;
  if not found then
    raise exception 'Forfeiting opens when the first playoff round opens for picks.';
  end if;

  if exists (
    select 1 from public.pickem_forfeits forfeit
    where forfeit.season_id = target_period.season_id
      and forfeit.player_id = target_player_id
      and forfeit.reversed_at is null
  ) then
    return query select target_period.season_id, 0, true;
    return;
  end if;

  insert into public.pickem_forfeits (season_id, player_id, forfeited_at)
  values (target_period.season_id, target_player_id, evaluated_at)
  returning id into forfeit_id;

  with scratched as (
    update public.picks pick
    set result = 'void'
    from public.games game
    join public.scoring_periods period on period.id = game.scoring_period_id
    where pick.player_id = target_player_id
      and pick.game_id = game.id
      and pick.result = 'pending'
      and period.season_id = target_period.season_id
      and period.period_type = 'playoff'
      and game.status = 'scheduled'
      and game.kickoff_at > evaluated_at
    returning pick.id, pick.game_id
  ), logged as (
    insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
    select target_player_id, 'ats_pick_voided', 'pick', scratched.id,
      jsonb_build_object('scoring_mode', 'against_spread', 'game_id', scratched.game_id, 'reason', 'forfeited')
    from scratched
    returning 1
  )
  select count(*) into voided from scratched;

  update public.pickem_forfeits set picks_voided = voided where id = forfeit_id;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (target_player_id, 'pickem_forfeited', 'pickem_forfeit', forfeit_id,
    jsonb_build_object('season_id', target_period.season_id, 'picks_voided', voided));

  return query select target_period.season_id, voided, false;
end;
$$;

create or replace function public.reverse_pickem_forfeit(
  target_player_id uuid,
  acting_player_id uuid,
  target_season_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reversed_id uuid;
begin
  perform 1 from public.players where id = acting_player_id and is_commissioner and active;
  if not found then
    raise exception 'Only the Commissioner can reverse a forfeit.';
  end if;

  update public.pickem_forfeits forfeit
  set reversed_at = clock_timestamp(), reversed_by_player_id = acting_player_id
  where forfeit.player_id = target_player_id
    and forfeit.reversed_at is null
    and (target_season_id is null or forfeit.season_id = target_season_id)
  returning forfeit.id into reversed_id;
  if reversed_id is null then
    return false;
  end if;

  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  values (acting_player_id, 'pickem_forfeit_reversed', 'pickem_forfeit', reversed_id,
    jsonb_build_object('player_id', target_player_id));
  return true;
end;
$$;

-- The database is the final authority: a forfeited player cannot save a Pick'em selection for that
-- season, whatever the route does. This keeps the latest hardened replacement path and only adds
-- the guard in front of it.
create or replace function public.replace_unlocked_picks(
  target_player_id uuid,
  target_scoring_period_id uuid,
  replacement_picks jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.pickem_forfeits forfeit
    join public.scoring_periods period on period.season_id = forfeit.season_id
    where period.id = target_scoring_period_id
      and forfeit.player_id = target_player_id
      and forfeit.reversed_at is null
  ) then
    raise exception 'You forfeited this season''s Pick''em, so your picks are final.';
  end if;

  perform public.assert_scoring_period_accepts_picks(target_scoring_period_id);

  with voided as (
    update public.picks p
    set result = 'void'
    from public.games g
    where p.player_id = target_player_id
      and p.scoring_period_id = target_scoring_period_id
      and p.game_id = g.id
      and p.result = 'pending'
      and g.status in ('postponed', 'cancelled', 'no_contest')
    returning p.id, p.player_id, p.game_id, g.status as game_status
  )
  insert into public.audit_logs (actor_player_id, action, entity_type, entity_id, details)
  select player_id, 'ats_pick_voided', 'pick', id,
    jsonb_build_object('scoring_mode', 'against_spread', 'game_id', game_id, 'reason', game_status)
  from voided;

  perform public.replace_unlocked_picks_unchecked_20260826(
    target_player_id,
    target_scoring_period_id,
    replacement_picks
  );
end;
$$;

revoke all on function public.forfeit_pickem_season(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.reverse_pickem_forfeit(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.replace_unlocked_picks(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.forfeit_pickem_season(uuid, timestamptz) to service_role;
grant execute on function public.reverse_pickem_forfeit(uuid, uuid, uuid) to service_role;
grant execute on function public.replace_unlocked_picks(uuid, uuid, jsonb) to service_role;
