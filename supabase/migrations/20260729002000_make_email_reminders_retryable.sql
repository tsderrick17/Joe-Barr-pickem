-- Preserve a bounded retry count for transient email failures and allow the
-- parent reminder to end in an explicit failed state instead of claiming that
-- delivery succeeded.

alter table public.email_reminder_deliveries
  add column if not exists attempt_count integer not null default 1
    check (attempt_count between 1 and 3);

alter table public.push_reminders
  drop constraint if exists push_reminders_status_check;

alter table public.push_reminders
  add constraint push_reminders_status_check
  check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled', 'test'));
