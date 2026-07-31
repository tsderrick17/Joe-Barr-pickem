-- Playoff cards are settled one day at a time, so players may opt into a
-- recap after each fully graded playoff day.
alter table public.players
  add column if not exists email_playoff_day_recap_enabled boolean not null default false;

alter table public.push_reminders
  drop constraint if exists push_reminders_category_check;
alter table public.push_reminders
  add constraint push_reminders_category_check
  check (category in ('weekly', 'final_lines', 'sunday_final_lines', 'early_lock', 'pick_due', 'weekly_recap', 'playoff_day_recap', 'ats_due', 'survivor_due', 'sunday_early_reveal', 'sunday_late_reveal', 'featured_window_reveal', 'custom'));
