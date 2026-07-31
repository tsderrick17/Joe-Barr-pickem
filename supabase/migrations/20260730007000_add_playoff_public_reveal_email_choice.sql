-- Playoff cards have several separate kickoff windows. Players may opt into a
-- public Pick'em receipt only after a window has actually begun.
alter table public.players
  add column if not exists email_playoff_public_reveal_enabled boolean not null default false;

alter table public.push_reminders
  drop constraint if exists push_reminders_category_check;
alter table public.push_reminders
  add constraint push_reminders_category_check
  check (category in ('weekly', 'final_lines', 'sunday_final_lines', 'early_lock', 'pick_due', 'weekly_recap', 'playoff_day_recap', 'playoff_public_reveal', 'ats_due', 'survivor_due', 'sunday_early_reveal', 'sunday_late_reveal', 'featured_window_reveal', 'custom'));
