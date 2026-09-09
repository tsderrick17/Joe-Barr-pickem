create table if not exists public.bowl_pool_schedule_changes (
  id uuid primary key default gen_random_uuid(), game_id uuid not null references public.bowl_pool_games(id) on delete cascade,
  old_kickoff_at timestamptz, new_kickoff_at timestamptz, old_away_team_id uuid, new_away_team_id uuid,
  old_home_team_id uuid, new_home_team_id uuid, detected_at timestamptz not null default now(), reviewed_at timestamptz
);
create index if not exists bowl_pool_schedule_changes_open_idx on public.bowl_pool_schedule_changes(game_id) where reviewed_at is null;

create or replace function public.audit_bowl_schedule_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.kickoff_at is distinct from new.kickoff_at or old.away_team_id is distinct from new.away_team_id or old.home_team_id is distinct from new.home_team_id then
    insert into bowl_pool_schedule_changes(game_id, old_kickoff_at, new_kickoff_at, old_away_team_id, new_away_team_id, old_home_team_id, new_home_team_id)
    values(old.id, old.kickoff_at, new.kickoff_at, old.away_team_id, new.away_team_id, old.home_team_id, new.home_team_id);
  end if;
  return new;
end; $$;
drop trigger if exists audit_bowl_schedule_change on public.bowl_pool_games;
create trigger audit_bowl_schedule_change after update on public.bowl_pool_games for each row execute function public.audit_bowl_schedule_change();
alter table public.bowl_pool_schedule_changes enable row level security;
revoke all on public.bowl_pool_schedule_changes from anon, authenticated;
grant all on public.bowl_pool_schedule_changes to service_role;
