create policy "Authenticated users can read seasons"
on public.seasons
for select
to authenticated
using (true);

create policy "Authenticated users can read scoring periods"
on public.scoring_periods
for select
to authenticated
using (true);

create policy "Authenticated users can read teams"
on public.teams
for select
to authenticated
using (true);

create policy "Authenticated users can read games"
on public.games
for select
to authenticated
using (true);