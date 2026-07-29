import { supabaseAdmin } from "@/lib/supabase-admin";

export type ReminderHealth = {
  overdueScheduled: number;
  staleSending: number;
  recentEmailFailures: number;
  problems: string[];
};

/**
 * A five-minute delivery worker is intentionally allowed some slack while a
 * Slate or recap settles. Past these thresholds it is no longer a harmless
 * wait: the Commissioner and uptime monitor should be told.
 */
export async function checkReminderHealth(now = new Date()): Promise<ReminderHealth> {
  const overdueAt = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const staleAt = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const failureSince = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [scheduledResult, sendingResult, failuresResult] = await Promise.all([
    supabaseAdmin.from("push_reminders").select("id", { count: "exact", head: true }).eq("status", "scheduled").lte("scheduled_for", overdueAt),
    supabaseAdmin.from("push_reminders").select("id, processing_started_at").eq("status", "sending"),
    supabaseAdmin.from("email_reminder_deliveries").select("reminder_id").in("status", ["failed", "suppressed"]).gte("attempted_at", failureSince),
  ]);
  if (scheduledResult.error || sendingResult.error || failuresResult.error) {
    throw new Error("Reminder delivery health could not be checked.");
  }

  const failedReminderIds = [...new Set((failuresResult.data ?? []).map((delivery) => delivery.reminder_id))];
  const { count: recentEmailFailures, error: failedRemindersError } = failedReminderIds.length
    ? await supabaseAdmin.from("push_reminders").select("id", { count: "exact", head: true }).in("id", failedReminderIds).neq("status", "test")
    : { count: 0, error: null };
  if (failedRemindersError) throw new Error("Reminder delivery health could not be checked.");

  const overdueScheduled = scheduledResult.count ?? 0;
  const staleSending = (sendingResult.data ?? []).filter((reminder) => !reminder.processing_started_at || new Date(reminder.processing_started_at) <= new Date(staleAt)).length;
  const failureCount = recentEmailFailures ?? 0;
  const problems: string[] = [];
  if (overdueScheduled) problems.push(`${overdueScheduled} reminder${overdueScheduled === 1 ? " has" : "s have"} been waiting more than 30 minutes for its pool update.`);
  if (staleSending) problems.push(`${staleSending} reminder${staleSending === 1 ? " is" : "s are"} stuck while sending.`);
  if (failureCount) problems.push(`${failureCount} email reminder ${failureCount === 1 ? "delivery failed" : "deliveries failed"} in the last 24 hours.`);
  return { overdueScheduled, staleSending, recentEmailFailures: failureCount, problems };
}
