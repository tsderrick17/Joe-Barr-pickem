-- Bowl Pool champions use the same immutable trophy ledger as the other pools.
alter table public.pool_championships drop constraint if exists pool_championships_pool_check;
alter table public.pool_championships add constraint pool_championships_pool_check check (pool in ('pickem', 'survivor', 'bowl'));

-- Preserve last year's explicitly supplied Bowl Pool winner once.
insert into public.pool_championships (season_year, pool, player_id, crowned_at)
select 2025, 'bowl', id, timestamptz '2026-01-25 00:00:00+00'
from public.players where lower(trim(first_name)) = 'al'
on conflict (season_year, pool) do nothing;
