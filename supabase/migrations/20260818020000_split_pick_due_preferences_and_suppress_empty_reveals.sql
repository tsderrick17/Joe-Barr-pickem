-- Split the old all-or-nothing pick reminder switch into the three player
-- choices shown in Notifications. Backfill from the existing choice before
-- applying defaults so no player's preference changes during deployment.
alter table public.players
  add column if not exists email_pick_due_sunday_early_enabled boolean,
  add column if not exists email_pick_due_sunday_afternoon_enabled boolean,
  add column if not exists email_pick_due_primetime_enabled boolean;

update public.players
set
  email_pick_due_sunday_early_enabled = coalesce(email_pick_due_sunday_early_enabled, email_pick_due_enabled),
  email_pick_due_sunday_afternoon_enabled = coalesce(email_pick_due_sunday_afternoon_enabled, email_pick_due_enabled),
  email_pick_due_primetime_enabled = coalesce(email_pick_due_primetime_enabled, email_pick_due_enabled)
where
  email_pick_due_sunday_early_enabled is null
  or email_pick_due_sunday_afternoon_enabled is null
  or email_pick_due_primetime_enabled is null;

alter table public.players
  alter column email_pick_due_sunday_early_enabled set default true,
  alter column email_pick_due_sunday_early_enabled set not null,
  alter column email_pick_due_sunday_afternoon_enabled set default true,
  alter column email_pick_due_sunday_afternoon_enabled set not null,
  alter column email_pick_due_primetime_enabled set default true,
  alter column email_pick_due_primetime_enabled set not null;

-- A public-reveal occurrence with no selections is a successful no-op, not a
-- delivery failure and not work that should retry forever.
alter table public.push_reminders
  add column if not exists suppression_reason text;

alter table public.push_reminders
  drop constraint if exists push_reminders_status_check;

alter table public.push_reminders
  add constraint push_reminders_status_check
  check (status in ('scheduled', 'sending', 'sent', 'failed', 'suppressed', 'cancelled', 'test'));

comment on column public.push_reminders.suppression_reason is
  'Why an automatic occurrence intentionally sent no email, such as an empty public-pick window.';
