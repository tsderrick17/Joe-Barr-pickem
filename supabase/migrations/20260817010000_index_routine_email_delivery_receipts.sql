-- Routine-email limiting reads each recipient's same-day successful receipts.
-- This index keeps that privacy-preserving check bounded as delivery history grows.

create index if not exists email_reminder_deliveries_player_delivered_idx
  on public.email_reminder_deliveries(player_id, delivered_at)
  where status = 'sent';
