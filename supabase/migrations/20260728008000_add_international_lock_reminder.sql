alter table public.players
  add column if not exists push_early_lock_enabled boolean not null default true,
  add column if not exists email_early_lock_enabled boolean not null default true;

alter table public.push_reminders
  drop constraint if exists push_reminders_category_check;
alter table public.push_reminders
  add constraint push_reminders_category_check
  check (category in ('weekly', 'final_lines', 'early_lock', 'pick_due', 'weekly_recap', 'ats_due', 'survivor_due', 'custom'));
