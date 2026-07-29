-- A recap is a receipt: save the exact settled data used to render its images
-- so the email does not drift when a later week becomes active.
alter table public.push_reminders
  add column if not exists recap_snapshot jsonb,
  add column if not exists recap_snapshot_at timestamptz;
