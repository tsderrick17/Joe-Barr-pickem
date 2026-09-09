-- Once a Bowl game has a pick or locked line, provider refreshes may not
-- silently replace its matchup or kickoff.
create or replace function public.protect_bowl_game_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.away_team_id is distinct from new.away_team_id or old.home_team_id is distinct from new.home_team_id or old.kickoff_at is distinct from new.kickoff_at)
     and (exists (select 1 from bowl_pool_picks where game_id=old.id) or exists (select 1 from bowl_pool_game_lines where game_id=old.id)) then
    raise exception 'A Bowl Pool matchup with picks or a locked line cannot be replaced.';
  end if;
  return new;
end; $$;

drop trigger if exists protect_bowl_game_identity on public.bowl_pool_games;
create trigger protect_bowl_game_identity before update on public.bowl_pool_games
for each row execute function public.protect_bowl_game_identity();
