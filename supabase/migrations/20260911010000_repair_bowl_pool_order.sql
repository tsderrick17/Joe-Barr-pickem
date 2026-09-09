-- Repair the Bowl Pool's generated order after the CFP first-round rows were
-- added. Ordering by kickoff is the canonical source of truth and makes this
-- safe to replay without touching teams, lines, picks, or results.
with ranked as (
  select id,
         row_number() over (partition by season_id order by kickoff_at, id)::integer as repaired_order
  from public.bowl_pool_games
)
update public.bowl_pool_games games
set order_index = ranked.repaired_order
from ranked
where games.id = ranked.id;
