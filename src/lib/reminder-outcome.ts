/**
 * What happens to a claimed reminder after each outcome, as pure functions: the status it ends in and when it is
 * tried again. The worker claims reminders, decides here, then writes. Nothing in this module touches the database.
 *
 * A reminder that has not started delivery is always safe to hand back; one whose delivery began is retried only if
 * the failure was in preparing the email (nothing left the building) or every failed address was a temporary
 * failure. Delivery receipts, not this module, are what stop a repeated attempt from emailing someone twice.
 */
export const RETRY_DELAY_MS = 15 * 60 * 1000;

export type ReminderUpdate = {
  status: "scheduled" | "sent" | "failed" | "suppressed";
  scheduled_for?: string;
  processing_started_at: null;
  updated_at: string;
  sent_at?: string | null;
  suppression_reason?: string | null;
};

export type DeliveryOutcome = { suppressed?: boolean; suppressionReason?: string | null; retryableFailed: number; failed: number };

const retryAt = (from: Date) => new Date(from.getTime() + RETRY_DELAY_MS).toISOString();

/** The email was not ready (a terminal reason suppresses it for good; otherwise it waits for the next run). */
export function updateForReadiness(readiness: { terminal?: boolean; reason?: string | null }, at: Date): ReminderUpdate {
  const updated_at = at.toISOString();
  return readiness.terminal
    ? { status: "suppressed", processing_started_at: null, suppression_reason: readiness.reason ?? null, updated_at }
    : { status: "scheduled", processing_started_at: null, updated_at };
}

/** After delivery was attempted: suppressed, retry later, failed for good, or sent. */
export function updateForDelivery(delivery: DeliveryOutcome, completedAt: Date): ReminderUpdate {
  const updated_at = completedAt.toISOString();
  if (delivery.suppressed) return { status: "suppressed", processing_started_at: null, suppression_reason: delivery.suppressionReason ?? null, updated_at };
  if (delivery.retryableFailed > 0) return { status: "scheduled", scheduled_for: retryAt(completedAt), processing_started_at: null, updated_at };
  if (delivery.failed > 0) return { status: "failed", processing_started_at: null, updated_at };
  return { status: "sent", sent_at: updated_at, processing_started_at: null, updated_at };
}

/** After an error: retry in 15 minutes if it is safe to, otherwise the reminder is marked failed. */
export function updateForError(safelyRetryable: boolean, failedAt: Date): ReminderUpdate {
  const updated_at = failedAt.toISOString();
  return safelyRetryable
    ? { status: "scheduled", scheduled_for: retryAt(failedAt), processing_started_at: null, updated_at }
    : { status: "failed", processing_started_at: null, updated_at };
}

/** An error is safely retryable if delivery never started, or it was a preparation failure (nothing was sent). */
export function isSafelyRetryable(deliveryStarted: boolean, preparationFailure: boolean) {
  return !deliveryStarted || preparationFailure;
}

/** A reminder handed back untouched because the run stopped before reaching it (no delay: it was never tried). */
export function updateForRelease(at: Date): ReminderUpdate {
  return { status: "scheduled", processing_started_at: null, updated_at: at.toISOString() };
}
