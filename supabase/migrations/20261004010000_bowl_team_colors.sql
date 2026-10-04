-- School colors for the Bowl Pool's pennants. The ESPN schedule import already
-- reads each team's own record, which carries its official primary and
-- alternate colors; saving them means a pennant always shows the school's real
-- colors next to the school's real abbreviation. Both are optional: a team
-- without colors gets a neutral navy pennant.
alter table public.bowl_pool_teams
  add column if not exists primary_color text,
  add column if not exists secondary_color text;

alter table public.bowl_pool_teams
  drop constraint if exists bowl_pool_teams_primary_color_hex,
  drop constraint if exists bowl_pool_teams_secondary_color_hex;
alter table public.bowl_pool_teams
  add constraint bowl_pool_teams_primary_color_hex check (primary_color is null or primary_color ~ '^#[0-9a-f]{6}$'),
  add constraint bowl_pool_teams_secondary_color_hex check (secondary_color is null or secondary_color ~ '^#[0-9a-f]{6}$');
