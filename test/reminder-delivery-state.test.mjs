import assert from "node:assert/strict";
import test from "node:test";
import {
  completedReminderUpdate,
  failedReminderUpdate,
} from "../src/lib/reminder-delivery-state.js";

const at = new Date("2026-10-06T12:00:00.000Z");
const retryAt = "2026-10-06T12:15:00.000Z";

test("successful reminder delivery records a sent receipt", () => {
  assert.deepEqual(completedReminderUpdate({ failed: 0, retryableFailed: 0 }, at), {
    status: "sent",
    sent_at: at.toISOString(),
    processing_started_at: null,
    updated_at: at.toISOString(),
  });
});

test("a retryable recipient failure requeues a partial batch after 15 minutes", () => {
  assert.deepEqual(completedReminderUpdate({ failed: 2, retryableFailed: 1 }, at), {
    status: "scheduled",
    scheduled_for: retryAt,
    processing_started_at: null,
    updated_at: at.toISOString(),
  });
});

test("non-retryable recipient failures mark the reminder failed", () => {
  assert.deepEqual(completedReminderUpdate({ failed: 1, retryableFailed: 0 }, at), {
    status: "failed",
    processing_started_at: null,
    updated_at: at.toISOString(),
  });
});

test("failure before delivery begins is safe to retry", () => {
  assert.deepEqual(
    failedReminderUpdate({ deliveryStarted: false, preparationFailure: false }, at),
    {
      safelyRetryable: true,
      update: {
        status: "scheduled",
        scheduled_for: retryAt,
        processing_started_at: null,
        updated_at: at.toISOString(),
      },
    },
  );
});

test("preparation failure remains retryable after entering delivery", () => {
  assert.equal(
    failedReminderUpdate({ deliveryStarted: true, preparationFailure: true }, at)
      .safelyRetryable,
    true,
  );
});

test("unknown failure after delivery begins cannot be blindly retried", () => {
  assert.deepEqual(
    failedReminderUpdate({ deliveryStarted: true, preparationFailure: false }, at),
    {
      safelyRetryable: false,
      update: {
        status: "failed",
        processing_started_at: null,
        updated_at: at.toISOString(),
      },
    },
  );
});
