import { ensureAutomaticBowlPoolEmails } from "@/lib/automatic-bowl-pool-emails";
import { ensureAutomaticEmailPlanMessages } from "@/lib/automatic-email-plan";
import { ensureAutomaticWeeklyRecap } from "@/lib/automatic-weekly-recap";

/** Reconcile future messages on a slower schedule than due-message delivery. */
export async function maintainAutomaticReminderSchedule() {
  const emailPlan = await ensureAutomaticEmailPlanMessages();
  const weeklyRecap = await ensureAutomaticWeeklyRecap();
  const bowlMessages = await ensureAutomaticBowlPoolEmails();
  return { emailPlan, weeklyRecap, bowlMessages };
}
