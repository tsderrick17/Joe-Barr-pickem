alter table public.push_reminders
  add column if not exists artwork_assets jsonb not null default '{}'::jsonb;

-- Email images are generated once by the reminder worker and then served as
-- immutable public objects, avoiding a Vercel function invocation on opens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-artwork',
  'email-artwork',
  true,
  20971520,
  array['image/png']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
