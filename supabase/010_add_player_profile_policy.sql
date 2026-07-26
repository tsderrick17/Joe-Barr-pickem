drop policy if exists "Players can read their own profile" on public.players;

create policy "Players can read their own profile"
on public.players
for select
to authenticated
using (auth.uid() = auth_user_id);