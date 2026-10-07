const RETRY_DELAY_MS = 15 * 60 * 1000;

/**
 * @typedef {{
 *   status: "scheduled" | "sent" | "failed";
 *   processing_started_at: null;
 *   updated_at: string;
 *   scheduled_for?: string;
 *   sent_at?: string;
 * }} ReminderDeliveryUpdate
 */

/**
 * @param {Date} at
 * @returns {string}
 */
function retryAt(at) {
  return new Date(at.getTime() + RETRY_DELAY_MS).toISOString();
}

/**
 * Delivery receipts prevent duplicate messages when a partial delivery is
 * retried. A retryable recipient failure therefore takes precedence over a
 * non-retryable failure in the same batch.
 *
 * @param {{ failed: number; retryableFailed: number }} delivery
 * @param {Date} completedAt
 * @returns {ReminderDeliveryUpdate}
 */
export function completedReminderUpdate(delivery, completedAt) {
  const updated_at = completedAt.toISOString();
  if (delivery.retryableFailed > 0) {
    return {
      status: "scheduled",
      scheduled_for: retryAt(completedAt),
      processing_started_at: null,
      updated_at,
    };
  }
  if (delivery.failed > 0) {
    return { status: "failed", processing_started_at: null, updated_at };
  }
  return {
    status: "sent",
    sent_at: updated_at,
    processing_started_at: null,
    updated_at,
  };
}

/**
 * Once delivery begins, an unknown failure may mean the provider accepted a
 * message. Only preparation failures can safely requeue at that point.
 *
 * @param {{ deliveryStarted: boolean; preparationFailure: boolean }} context
 * @param {Date} failedAt
 * @returns {{ safelyRetryable: boolean; update: ReminderDeliveryUpdate }}
 */
export function failedReminderUpdate(context, failedAt) {
  const safelyRetryable = !context.deliveryStarted || context.preparationFailure;
  const updated_at = failedAt.toISOString();
  return {
    safelyRetryable,
    update: safelyRetryable
      ? {
          status: "scheduled",
          scheduled_for: retryAt(failedAt),
          processing_started_at: null,
          updated_at,
        }
      : { status: "failed", processing_started_at: null, updated_at },
  };
}
