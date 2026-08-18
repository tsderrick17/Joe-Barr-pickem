import {
  deliverEmailReminder,
  ReminderPreparationError,
} from "@/lib/email-reminders";
import { ensureAutomaticWeeklyRecap } from "@/lib/automatic-weekly-recap";
import { ensureAutomaticEmailPlanMessages } from "@/lib/automatic-email-plan";
import type {
  ReminderAudience,
  ReminderCategory,
} from "@/lib/reminder-audience";
import { reminderReadiness } from "@/lib/reminder-readiness";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Reminder = {
  id: string;
  category: ReminderCategory;
  audience: ReminderAudience;
  title: string;
  body: string;
  source_game_ids?: string[];
};

type ClaimedReminderUpdate = {
  status: "scheduled" | "sent" | "failed";
  scheduled_for?: string;
  processing_started_at: null;
  updated_at: string;
  sent_at?: string;
};

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

export async function sendDueReminders() {
  await ensureAutomaticEmailPlanMessages();
  await ensureAutomaticWeeklyRecap();
  // The table/RPC retain their historical push-oriented names so this cleanup
  // does not risk a destructive production data migration.
  const { data: reminders, error } = await supabaseAdmin.rpc(
    "claim_due_push_reminders",
  );
  if (error) throw new Error("Due email reminders could not be claimed.");

  const result = {
    reminders: 0,
    deferred: 0,
    emailSent: 0,
    emailFailed: 0,
  };

  for (const reminder of (reminders ?? []) as Reminder[]) {
    let deliveryStarted = false;
    try {
      const readiness = await reminderReadiness(reminder.category, reminder.source_game_ids);
      if (!readiness.ready) {
        await updateClaimedReminder(reminder.id, {
          status: "scheduled",
          processing_started_at: null,
          updated_at: new Date().toISOString(),
        });

        result.deferred += 1;
        continue;
      }

      deliveryStarted = true;
      const emailDelivery = await deliverEmailReminder(reminder);
      const completedAt = new Date();
      const reminderUpdate: ClaimedReminderUpdate =
        emailDelivery.retryableFailed > 0
          ? {
              status: "scheduled",
              scheduled_for: new Date(
                completedAt.getTime() + 15 * 60 * 1000,
              ).toISOString(),
              processing_started_at: null,
              updated_at: completedAt.toISOString(),
            }
          : emailDelivery.failed > 0
            ? {
                status: "failed",
                processing_started_at: null,
                updated_at: completedAt.toISOString(),
              }
            : {
                status: "sent",
                sent_at: completedAt.toISOString(),
                processing_started_at: null,
                updated_at: completedAt.toISOString(),
              };
      await updateClaimedReminder(reminder.id, reminderUpdate);

      result.reminders += 1;
      result.emailSent += emailDelivery.sent;
      result.emailFailed += emailDelivery.failed;
    } catch (reason) {
      const safelyRetryable =
        !deliveryStarted || reason instanceof ReminderPreparationError;
      const failedAt = new Date();
      await updateClaimedReminder(
        reminder.id,
        safelyRetryable
          ? {
              status: "scheduled",
              scheduled_for: new Date(
                failedAt.getTime() + 15 * 60 * 1000,
              ).toISOString(),
              processing_started_at: null,
              updated_at: failedAt.toISOString(),
            }
          : {
              status: "failed",
              processing_started_at: null,
              updated_at: failedAt.toISOString(),
            },
      );
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
