alter table public.players
  add column if not exists notification_email text,
  add column if not exists email_notifications_enabled boolean not null default false,
  add column if not exists notification_preferences_updated_at timestamptz;

alter table public.players
  drop constraint if exists players_email_notifications_require_address;

alter table public.players
  add constraint players_email_notifications_require_address
  check (not email_notifications_enabled or notification_email is not null);
