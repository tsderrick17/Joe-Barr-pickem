-- Operational Bowl Pool settlement ledger. Missing picks are losses without
-- creating a fake selected team, and every automatic transition is auditable.
create table if not exists public.bowl_pool_game_results (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.bowl_pool_entries(id) on delete cascade,
  game_id uuid not null references public.bowl_pool_games(id) on delete restrict,
  result text not null check (result in ('win', 'loss', 'void')),
  reason text not null check (reason in ('missing_pick', 'graded', 'voided')),
  graded_at timestamptz not null default now(),
  unique (entry_id, game_id)
);

create index if not exists bowl_pool_game_results_entry_idx
  on public.bowl_pool_game_results(entry_id, result);

create or replace function public.settle_bowl_pool_missing_picks(evaluated_at timestamptz default clock_timestamp())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inserted_count integer := 0;
begin
  insert into public.bowl_pool_game_results(entry_id, game_id, result, reason, graded_at)
  select entry.id, game.id, 'loss', 'missing_pick', evaluated_at
  from public.bowl_pool_entries entry
  join public.bowl_pool_games game on game.season_id = entry.season_id
  where entry.status = 'active'
    and game.kickoff_at <= evaluated_at
    and game.status in ('live', 'final')
    and not exists (select 1 from public.bowl_pool_picks pick where pick.entry_id = entry.id and pick.game_id = game.id)
    and not exists (select 1 from public.bowl_pool_game_results result where result.entry_id = entry.id and result.game_id = game.id)
  on conflict (entry_id, game_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.settle_bowl_pool_missing_picks(timestamptz) from public, anon, authenticated;
grant execute on function public.settle_bowl_pool_missing_picks(timestamptz) to service_role;

alter table public.bowl_pool_game_results enable row level security;
revoke all on table public.bowl_pool_game_results from public, anon, authenticated;
grant all on table public.bowl_pool_game_results to service_role;
