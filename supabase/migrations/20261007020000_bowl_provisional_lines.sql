-- A Bowl line is preliminary until its game day morning, like an NFL spread: the sync keeps the latest provider
-- spread on the line row with locked_at empty, and fills locked_at when the line locks (8 AM Eastern on game day).
-- The sync and the Bowl pages were written that way, but locked_at was created NOT NULL DEFAULT now(), so saving a
-- preliminary line would have been rejected. Allow it to be empty, and stop it defaulting to "locked right now".
alter table public.bowl_pool_game_lines
  alter column locked_at drop not null,
  alter column locked_at drop default;

-- The matchup guard protects a game with picks or a *locked* line. A preliminary line (locked_at empty) must not
-- freeze the matchup: providers move bowl kickoff times and fill in teams while a spread is still preliminary.
create or replace function public.protect_bowl_game_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.away_team_id is distinct from new.away_team_id or old.home_team_id is distinct from new.home_team_id or old.kickoff_at is distinct from new.kickoff_at)
     and (exists (select 1 from bowl_pool_picks where game_id=old.id)
          or exists (select 1 from bowl_pool_game_lines where game_id=old.id and locked_at is not null)) then
    raise exception 'A Bowl Pool matchup with picks or a locked line cannot be replaced.';
  end if;
  return new;
end; $$;
