-- Commissioner-owned wording for future standard reminder emails. Existing
-- reminder rows remain their own immutable record of what was sent.
create table if not exists public.reminder_templates (
  template_id text primary key,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 220),
  updated_by_player_id uuid not null references public.players(id),
  updated_at timestamptz not null default now()
);

alter table public.reminder_templates enable row level security;
revoke all on table public.reminder_templates from anon, authenticated;
