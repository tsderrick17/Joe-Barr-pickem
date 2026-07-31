-- GIFs remain link-based so chat stays lightweight and does not need a paid
-- media-hosting account. An empty text body is valid only when a GIF is sent.
alter table public.pool_chat_messages
  add column if not exists gif_url text;

alter table public.pool_chat_messages
  drop constraint if exists pool_chat_messages_body_check;

alter table public.pool_chat_messages
  add constraint pool_chat_messages_body_check
  check (
    char_length(btrim(body)) <= 280
    and (char_length(btrim(body)) > 0 or gif_url is not null)
  );
