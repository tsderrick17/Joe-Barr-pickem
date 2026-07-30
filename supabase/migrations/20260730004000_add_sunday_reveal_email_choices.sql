-- Sunday reveal notes are opt-in and separated by kickoff window. The
-- categories keep their own delivery receipts, so a retry can never duplicate
-- the other window's email.
alter table public.players
  add column if not exists email_sunday_early_reveal_enabled boolean not null default false,
  add column if not exists email_sunday_late_reveal_enabled boolean not null default false;

alter table public.push_reminders
  drop constraint if exists push_reminders_category_check;
alter table public.push_reminders
  add constraint push_reminders_category_check
  check (category in ('weekly', 'final_lines', 'sunday_final_lines', 'early_lock', 'pick_due', 'weekly_recap', 'ats_due', 'survivor_due', 'sunday_early_reveal', 'sunday_late_reveal', 'custom'));
