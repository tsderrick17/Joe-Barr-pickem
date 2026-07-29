-- Named player choices mirror the pool's actual weekly rhythm.  The legacy
-- categories remain valid for old receipts; new reminders use the choices below.
alter table public.players
  add column if not exists push_final_lines_enabled boolean not null default true,
  add column if not exists push_pick_due_enabled boolean not null default true,
  add column if not exists push_weekly_recap_enabled boolean not null default true,
  add column if not exists email_final_lines_enabled boolean not null default true,
  add column if not exists email_pick_due_enabled boolean not null default true,
  add column if not exists email_weekly_recap_enabled boolean not null default true;

alter table public.push_reminders
  drop constraint if exists push_reminders_category_check;
alter table public.push_reminders
  add constraint push_reminders_category_check
  check (category in ('weekly', 'final_lines', 'pick_due', 'weekly_recap', 'ats_due', 'survivor_due', 'custom'));

alter table public.push_reminders
  drop constraint if exists push_reminders_audience_check;
alter table public.push_reminders
  add constraint push_reminders_audience_check
  check (audience in ('all_active', 'pick_due', 'ats_due', 'survivor_due'));
