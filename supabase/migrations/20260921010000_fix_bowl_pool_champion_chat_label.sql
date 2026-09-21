-- Announce Bowl Pool champions with the correct pool label.
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

  pool_label := case new.pool
    when 'pickem' then 'Pick''em'
    when 'survivor' then 'Survivor'
    when 'bowl' then 'Bowl Pool'
    else initcap(new.pool)
  end;

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

revoke all on function public.announce_pool_champion_in_chat() from public, anon, authenticated;
grant execute on function public.announce_pool_champion_in_chat() to service_role;
