-- Keep removed messages available to commissioners without leaving them visible
-- in the player-facing chat. GIF-only legacy notes receive a short audit-safe
-- placeholder before the retired media column is removed.
update public.pool_chat_messages
set body = '[GIF removed]'
where char_length(btrim(body)) = 0;

alter table public.pool_chat_messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_player_id uuid references public.players(id) on delete set null;

alter table public.pool_chat_messages
  drop constraint if exists pool_chat_messages_body_check;

alter table public.pool_chat_messages
  drop column if exists gif_url;

alter table public.pool_chat_messages
  add constraint pool_chat_messages_body_check
  check (char_length(btrim(body)) between 1 and 280);

create index if not exists pool_chat_messages_active_season_created_idx
  on public.pool_chat_messages (season_id, deleted_at, created_at desc);
