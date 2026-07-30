-- Players may choose either every game-day final-lines email or Sunday only.
-- Keeping these separate prevents a Sunday duplicate while preserving an
-- existing every-game-day preference.
alter table public.players
  add column if not exists email_sunday_final_lines_enabled boolean not null default false;

alter table public.push_reminders
  drop constraint if exists push_reminders_category_check;
alter table public.push_reminders
  add constraint push_reminders_category_check
  check (category in ('weekly', 'final_lines', 'sunday_final_lines', 'early_lock', 'pick_due', 'weekly_recap', 'ats_due', 'survivor_due', 'custom'));
