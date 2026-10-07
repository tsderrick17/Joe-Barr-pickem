import {
  deliverEmailReminder,
  ReminderPreparationError,
} from "@/lib/email-reminders";
import type {
  ReminderAudience,
  ReminderCategory,
} from "@/lib/reminder-audience";
import { reminderReadiness } from "@/lib/reminder-readiness";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkpoint, ExecutionCancelledError } from "@/lib/execution-context";
import { isSafelyRetryable, updateForDelivery, updateForError, updateForReadiness, updateForRelease, type ReminderUpdate } from "@/lib/reminder-outcome";

type Reminder = {
  id: string;
  category: ReminderCategory;
  audience: ReminderAudience;
  title: string;
  body: string;
  automation_key?: string | null;
  source_game_ids?: string[];
  source_scoring_period_id?: string | null;
};

type ClaimedReminderUpdate = ReminderUpdate;

async function updateClaimedReminder(
  reminderId: string,
  values: ClaimedReminderUpdate,
) {
  const { data, error } = await supabaseAdmin
    .from("push_reminders")
    .update(values)
    .eq("id", reminderId)
    .eq("status", "sending")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error("The reminder delivery state could not be recorded.");
  }
}

/** Best effort, one write each: a failure leaves the reminder claimed, and the stale-claim recovery returns it. */
async function releaseUnstartedReminders(reminders: Reminder[]) {
  for (const reminder of reminders) {
    try {
      await updateClaimedReminder(reminder.id, updateForRelease(new Date()));
    } catch {
      console.error("A claimed reminder could not be handed back after a stopped run.", { reminderId: reminder.id });
    }
  }
}

export async function sendDueReminders() {
  // The table/RPC retain their historical push-oriented names so this cleanup
  // does not risk a destructive production data migration.
  const { data: reminders, error } = await supabaseAdmin.rpc(
    "claim_due_push_reminders",
  );
  if (error) throw new Error("Due email reminders could not be claimed.");

  const result = {
    reminders: 0,
    deferred: 0,
    suppressed: 0,
    emailSent: 0,
    emailFailed: 0,
  };

  const claimed = (reminders ?? []) as Reminder[];
  for (const [index, reminder] of claimed.entries()) {
    // Stop between reminders, never inside one. A reminder this run has not reached has not started delivery, so it is
    // handed straight back to the queue instead of waiting out the stale-claim timer.
    try {
      checkpoint("next reminder");
    } catch (error) {
      if (error instanceof ExecutionCancelledError) {
        await releaseUnstartedReminders(claimed.slice(index));
      }
      throw error;
    }
    let deliveryStarted = false;
    try {
      const readiness = await reminderReadiness(reminder.category, reminder.source_game_ids, reminder.source_scoring_period_id);
      if (!readiness.ready) {
        await updateClaimedReminder(reminder.id, updateForReadiness(readiness, new Date()));
        if (readiness.terminal) result.suppressed += 1;
        else result.deferred += 1;
        continue;
      }

      deliveryStarted = true;
      const emailDelivery = await deliverEmailReminder(reminder);
      const completedAt = new Date();
      if (emailDelivery.suppressed) {
        await updateClaimedReminder(reminder.id, updateForDelivery(emailDelivery, completedAt));
        result.reminders += 1;
        result.suppressed += 1;
        continue;
      }
      const reminderUpdate = updateForDelivery(emailDelivery, completedAt);
      await updateClaimedReminder(reminder.id, reminderUpdate);

      result.reminders += 1;
      result.emailSent += emailDelivery.sent;
      result.emailFailed += emailDelivery.failed;
    } catch (reason) {
      const safelyRetryable = isSafelyRetryable(deliveryStarted, reason instanceof ReminderPreparationError);
      await updateClaimedReminder(reminder.id, updateForError(safelyRetryable, new Date()));
      console.error("Email reminder delivery could not be completed.", {
        reminderId: reminder.id,
        safelyRetryable,
        message:
          reason instanceof Error
            ? reason.message
            : "Unknown reminder delivery error.",
      });
      result.reminders += 1;
      result.emailFailed += 1;
    }
  }

  return result;
}
