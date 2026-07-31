-- Player display choices are private, durable preferences. They never affect
-- pool data; they only control whether the optional Survivor table and the
-- shared chat are expanded for that player.
alter table public.players
  add column if not exists show_survivor_standings boolean not null default true,
  add column if not exists show_pool_chat boolean not null default true;

-- Championship announcements are authored by the Commissioner account but
-- explicitly marked as moderator notes. The unique championship reference
-- guarantees a pool champion is congratulated exactly once in the shared chat.
alter table public.pool_chat_messages
  add column if not exists is_moderator boolean not null default false,
  add column if not exists championship_id uuid unique references public.pool_championships(id) on delete set null;

create or replace function public.announce_pool_champion_in_chat()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  champion_name text;
  moderator_player_id uuid;
  pool_label text;
begin
  if new.season_id is null then
    return new;
  end if;

  select first_name into champion_name from public.players where id = new.player_id;
  select id into moderator_player_id
  from public.players
  where active and is_commissioner
  order by created_at, id
  limit 1;

  if champion_name is null or moderator_player_id is null then
    return new;
  end if;

  pool_label := case new.pool when 'pickem' then 'Pick''em' else 'Survivor' end;

  insert into public.pool_chat_messages (
    season_id, player_id, body, is_moderator, championship_id
  ) values (
    new.season_id,
    moderator_player_id,
    format('🏆 Congratulations, %s — %s Champion!', champion_name, pool_label),
    true,
    new.id
  ) on conflict (championship_id) do nothing;

  return new;
end;
$$;

drop trigger if exists announce_pool_champion_in_chat on public.pool_championships;
create trigger announce_pool_champion_in_chat
after insert on public.pool_championships
for each row execute function public.announce_pool_champion_in_chat();

revoke all on function public.announce_pool_champion_in_chat() from public, anon, authenticated;
grant execute on function public.announce_pool_champion_in_chat() to service_role;
