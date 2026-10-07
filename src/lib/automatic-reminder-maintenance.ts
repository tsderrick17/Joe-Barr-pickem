import { ensureAutomaticBowlPoolEmails } from "@/lib/automatic-bowl-pool-emails";
import { ensureAutomaticEmailPlanMessages } from "@/lib/automatic-email-plan";
import { ensureAutomaticWeeklyRecap } from "@/lib/automatic-weekly-recap";

/** Reconcile future messages on a slower schedule than due-message delivery. */
export async function maintainAutomaticReminderSchedule(signal?: AbortSignal) {
  signal?.throwIfAborted();
  const emailPlan = await ensureAutomaticEmailPlanMessages(signal);
  signal?.throwIfAborted();
  const weeklyRecap = await ensureAutomaticWeeklyRecap(new Date(), signal);
  signal?.throwIfAborted();
  const bowlMessages = await ensureAutomaticBowlPoolEmails(new Date(), signal);
  signal?.throwIfAborted();
  return { emailPlan, weeklyRecap, bowlMessages };
}
