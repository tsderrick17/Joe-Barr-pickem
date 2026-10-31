-- The one-time "last call" email and phone notification (24 hours before the first Bowl kickoff, to players who have not joined the Bowl Pool)
-- is a reminder of its own kind.
alter table public.push_reminders drop constraint if exists push_reminders_category_check;
alter table public.push_reminders add constraint push_reminders_category_check
  check (category in ('weekly', 'final_lines', 'sunday_final_lines', 'early_lock', 'pick_due', 'weekly_recap', 'playoff_day_recap', 'playoff_public_reveal', 'sunday_early_reveal', 'sunday_late_reveal', 'featured_window_reveal', 'ats_due', 'survivor_due', 'bowl_line_lock', 'bowl_daily_recap', 'bowl_pick_due', 'bowl_pool_open', 'bowl_pool_last_call', 'custom'));
