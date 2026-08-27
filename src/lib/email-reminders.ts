import {
  eligiblePlayerIds,
  type ReminderAudience,
  type ReminderCategory,
} from "@/lib/reminder-audience";
import { emailPreferenceColumn } from "@/lib/email-plan-preferences.js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ensureEarlyLockSnapshot, ensureFeaturedWindowRevealSnapshot, ensureFreshSlateSnapshot, ensureGameDaySlateSnapshot, ensurePlayoffDayRecapSnapshot, ensurePlayoffPublicRevealSnapshot, ensureSundayRevealSnapshot, ensureWeeklyRecapSnapshot } from "@/lib/weekly-recap";

type Reminder = {
  id: string;
  category: ReminderCategory;
  audience: ReminderAudience;
  title: string;
  body: string;
  automation_key?: string | null;
  recap_snapshot?: unknown;
};

type EmailRecipient = {
  playerId: string;
  email: string;
};

type ExistingDelivery = {
  id: string;
  status: "sending" | "sent" | "failed" | "suppressed";
  provider_status: number | null;
  attempt_count: number;
};

class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly providerStatus: number,
  ) {
    super(message);
  }
}

export class ReminderPreparationError extends Error {}

class ReminderDeliveryUncertainError extends Error {}

const MAX_EMAIL_ATTEMPTS = 3;
const EMAIL_TIMEOUT_MS = 15_000;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

const siteUrl = "https://pickemjb.vercel.app";

function survivorIsStillRunning(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || !("kind" in snapshot) || snapshot.kind !== "weekly_recap" || !("survivor" in snapshot)) return false;
  const survivor = snapshot.survivor;
  return Boolean(survivor && typeof survivor === "object" && (("in" in survivor && typeof survivor.in === "number" && survivor.in > 1) || ("championCrownedInRecapWeek" in survivor && survivor.championCrownedInRecapWeek === true)));
}

function playoffEliminationCopy(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || !("kind" in snapshot) || snapshot.kind !== "playoff_day_recap" || !("eliminatedToday" in snapshot) || !Array.isArray(snapshot.eliminatedToday) || snapshot.eliminatedToday.length === 0) return "";
  const names = snapshot.eliminatedToday.filter((name): name is string => typeof name === "string");
  if (!names.length) return "";
  return `Eliminated from Pick'em today: ${names.join(", ")}.`;
}

function weeklySurvivorUpdateCopy(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || !("kind" in snapshot) || snapshot.kind !== "weekly_recap" || !("survivor" in snapshot)) return "";
  const survivor = snapshot.survivor;
  if (!survivor || typeof survivor !== "object" || !("in" in survivor) || typeof survivor.in !== "number") return "";
  const eliminated = "rows" in survivor && Array.isArray(survivor.rows)
    ? survivor.rows.flatMap((row) => row && typeof row === "object" && "eliminatedInRecapWeek" in row && row.eliminatedInRecapWeek === true && "name" in row && typeof row.name === "string" ? [row.name] : [])
    : [];
  const eliminationCopy = eliminated.length
    ? `${eliminated.join(", ")} ${eliminated.length === 1 ? "was" : "were"} eliminated this week. `
    : "";
  return `${eliminationCopy}${survivor.in} ${survivor.in === 1 ? "entry remains" : "entries remain"}.`;
}

function playoffChampionCopy(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || !("kind" in snapshot) || snapshot.kind !== "playoff_day_recap" || !("championsCrowned" in snapshot) || !Array.isArray(snapshot.championsCrowned)) return "";
  const names = snapshot.championsCrowned.filter((name): name is string => typeof name === "string");
  if (!names.length) return "";
  return names.length === 1
    ? `Congratulations, ${names[0]} — Pick'em Champion!`
    : `Congratulations to our Pick'em co-champions: ${names.join(", ")}!`;
}

function messageHtml(reminder: Reminder) {
  const recapImages = reminder.category === "weekly_recap" || reminder.category === "playoff_day_recap"
    ? `<div style="margin-top:28px"><a href="${siteUrl}" style="display:block"><img alt="Pick'em standings and this week's picks" src="${siteUrl}/api/recap-image?reminder=${encodeURIComponent(reminder.id)}&kind=summary" style="display:block;height:auto;margin:0 0 18px;width:100%"></a>${reminder.category === "weekly_recap" && survivorIsStillRunning(reminder.recap_snapshot) ? `<a href="${siteUrl}/board#slate-matchups" style="display:block"><img alt="Active Survivor board" src="${siteUrl}/api/recap-image?reminder=${encodeURIComponent(reminder.id)}&kind=survivor" style="display:block;height:auto;width:100%"></a>` : ""}</div>`
    : reminder.category === "weekly"
      ? `<div style="margin-top:28px"><a href="${siteUrl}/board" style="display:block"><img alt="This week's preliminary Slate" src="${siteUrl}/api/recap-image?reminder=${encodeURIComponent(reminder.id)}&kind=fresh" style="display:block;height:auto;width:100%"></a></div>`
      : reminder.category === "final_lines" || reminder.category === "sunday_final_lines"
      ? `<div style="margin-top:28px"><a href="${siteUrl}/board" style="display:block"><img alt="Today's official Slate" src="${siteUrl}/api/recap-image?reminder=${encodeURIComponent(reminder.id)}&kind=gameday" style="display:block;height:auto;width:100%"></a></div>`
      : reminder.category === "early_lock"
        ? `<div style="margin-top:28px"><a href="${siteUrl}/board" style="display:block"><img alt="International game official line" src="${siteUrl}/api/recap-image?reminder=${encodeURIComponent(reminder.id)}&kind=earlylock" style="display:block;height:auto;width:100%"></a></div>`
        : reminder.category === "sunday_early_reveal" || reminder.category === "sunday_late_reveal" || reminder.category === "featured_window_reveal" || reminder.category === "playoff_public_reveal"
          ? `<div style="margin-top:28px"><a href="${siteUrl}" style="display:block"><img alt="Public Pick'em standings and revealed selections" src="${siteUrl}/api/recap-image?reminder=${encodeURIComponent(reminder.id)}&kind=reveal" style="display:block;height:auto;width:100%"></a></div>`
        : "";
  const isRecap = reminder.category === "weekly_recap" || reminder.category === "playoff_day_recap";
  const isPublicReceipt = reminder.category === "playoff_public_reveal" || reminder.category === "sunday_early_reveal" || reminder.category === "sunday_late_reveal" || reminder.category === "featured_window_reveal";
  const destination = isRecap || isPublicReceipt ? siteUrl : `${siteUrl}/board`;
  const callToAction = isRecap ? "Open Pick'em Pad" : isPublicReceipt ? "View public receipts" : "Open The Slate";
  const eliminationCopy = playoffEliminationCopy(reminder.recap_snapshot);
  const eliminationBlock = eliminationCopy ? `<p style="background:#fef2f2;border-left:4px solid #b91c1c;color:#7f1d1d;font:700 14px/1.5 Arial,sans-serif;margin:20px 0 0;padding:12px 14px">${escapeHtml(eliminationCopy)}</p>` : "";
  const championCopy = playoffChampionCopy(reminder.recap_snapshot);
  const championBlock = championCopy ? `<p style="background:#ecfdf5;border-left:4px solid #007e72;color:#064e3b;font:700 16px/1.5 Arial,sans-serif;margin:20px 0 0;padding:12px 14px">${escapeHtml(championCopy)}</p>` : "";
  const survivorUpdateCopy = weeklySurvivorUpdateCopy(reminder.recap_snapshot);
  const survivorUpdateBlock = survivorUpdateCopy ? `<p style="background:#f8fafc;border-left:4px solid #475569;color:#1e293b;font:700 14px/1.5 Arial,sans-serif;margin:20px 0 0;padding:12px 14px">${escapeHtml(survivorUpdateCopy)}</p>` : "";
  return `<main style="background:#fffdf8;color:#171719;font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px"><p style="font:700 12px Arial,sans-serif;letter-spacing:.16em;color:#475569;margin:0 0 8px">JOE BARR MEMORIAL PICK'EM</p><h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">${escapeHtml(reminder.title)}</h1><p style="font:18px/1.5 Arial,sans-serif;margin:0">${escapeHtml(reminder.body)}</p>${championBlock}${eliminationBlock}${survivorUpdateBlock}${recapImages}<p style="margin:24px 0 0"><a href="${destination}" style="display:inline-block;background:#007e72;border-radius:6px;color:#fff;padding:12px 18px;text-decoration:none;font:700 15px Arial,sans-serif">${callToAction}</a></p><hr style="border:0;border-top:1px solid #d6d3d1;margin:28px 0 16px"><p style="font:12px/1.5 Arial,sans-serif;color:#57534e;margin:0">Only winners count; pushes and ties are losers.</p><p style="font:12px/1.5 Arial,sans-serif;color:#57534e;margin:8px 0 0">You received this because you opted into Joe Barr Memorial Pick'em email reminders. <a href="${siteUrl}/profile" style="color:#57534e">Change your choices in Notifications.</a></p></main>`;
}

async function recipientsForReminder(reminder: Reminder) {
  const playerIds = await eligiblePlayerIds(reminder.audience);
  if (playerIds.length === 0) return [] as EmailRecipient[];
  const preference = emailPreferenceColumn(reminder.category, reminder.automation_key);
  const { data, error } = await supabaseAdmin
    .from("players")
    .select(`id, notification_email, email_notifications_enabled, ${preference}`)
    .in("id", playerIds)
    .eq("email_notifications_enabled", true)
    .not("notification_email", "is", null);
  if (error) throw new Error("Email reminder choices could not be read.");
  return ((data ?? []) as unknown as Array<{ id: string; notification_email: string | null } & Record<string, boolean | null>>)
    .filter((player) => player[preference] === true && Boolean(player.notification_email))
    .map((player) => ({ playerId: player.id, email: player.notification_email! }));
}

async function recordAndSend(reminder: Reminder, recipient: EmailRecipient) {
  const { data: createdDelivery, error: createError } = await supabaseAdmin
    .from("email_reminder_deliveries")
    .insert({ reminder_id: reminder.id, player_id: recipient.playerId, email_address: recipient.email })
    .select("id, status, provider_status, attempt_count")
    .maybeSingle();

  let delivery = createdDelivery as ExistingDelivery | null;

  if (createError?.code === "23505") {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("email_reminder_deliveries")
      .select("id, status, provider_status, attempt_count")
      .eq("reminder_id", reminder.id)
      .eq("player_id", recipient.playerId)
      .maybeSingle();

    if (existingError || !existing) {
      throw new ReminderPreparationError(
        "An existing email delivery receipt could not be loaded.",
      );
    }

    delivery = existing as ExistingDelivery;

    if (delivery.status === "sent" || delivery.status === "suppressed") {
      return { skipped: true, sent: false, failed: false, retryable: false, errorMessage: null };
    }
    if (delivery.status === "sending") {
      return {
        skipped: false,
        sent: false,
        failed: true,
        retryable: false,
        errorMessage: "A previous email attempt has an uncertain delivery state.",
      };
    }

    const previousFailureWasRetryable =
      delivery.provider_status === 425 ||
      delivery.provider_status === 429;

    if (!previousFailureWasRetryable || delivery.attempt_count >= MAX_EMAIL_ATTEMPTS) {
      return {
        skipped: false,
        sent: false,
        failed: true,
        retryable: false,
        errorMessage: "Email delivery could not be completed after safe retries.",
      };
    }

    const { data: retriedDelivery, error: retryError } = await supabaseAdmin
      .from("email_reminder_deliveries")
      .update({
        status: "sending",
        provider_status: null,
        error_message: null,
        attempted_at: new Date().toISOString(),
        attempt_count: delivery.attempt_count + 1,
      })
      .eq("id", delivery.id)
      .eq("status", "failed")
      .select("id, status, provider_status, attempt_count")
      .maybeSingle();

    if (retryError || !retriedDelivery) {
      throw new ReminderPreparationError(
        "A failed email delivery could not be prepared for retry.",
      );
    }

    delivery = retriedDelivery as ExistingDelivery;
  } else if (createError || !delivery) {
    throw new ReminderPreparationError(
      "An email delivery receipt could not be created.",
    );
  }

  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  if (!key || !sender) {
    const { error: setupReceiptError } = await supabaseAdmin
      .from("email_reminder_deliveries")
      .update({
        status: "failed",
        error_message: "Email sender setup is incomplete.",
      })
      .eq("id", delivery.id);
    if (setupReceiptError) {
      throw new ReminderPreparationError(
        "Email sender setup and its delivery receipt could not be verified.",
      );
    }
    return { skipped: false, sent: false, failed: true, retryable: false, errorMessage: "Email sender setup is incomplete." };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "PickemJB", email: sender },
        to: [{ email: recipient.email }],
        subject: reminder.title,
        htmlContent: messageHtml(reminder),
        textContent: `${reminder.title}\n\n${reminder.body}${playoffChampionCopy(reminder.recap_snapshot) ? `\n\n${playoffChampionCopy(reminder.recap_snapshot)}` : ""}${playoffEliminationCopy(reminder.recap_snapshot) ? `\n\n${playoffEliminationCopy(reminder.recap_snapshot)}` : ""}\n\nOpen Pick'em: ${reminder.category === "weekly_recap" || reminder.category === "playoff_day_recap" || reminder.category === "playoff_public_reveal" || reminder.category === "sunday_early_reveal" || reminder.category === "sunday_late_reveal" ? siteUrl : `${siteUrl}/board`}\n\nOnly winners count; pushes and ties are losers.\n\nChange your choices in Notifications: ${siteUrl}/profile`,
        tags: ["pickem-reminder", reminder.category],
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => ({})) as { messageId?: string; code?: string; message?: string };
    if (!response.ok) {
      throw new EmailProviderError(
        payload.message ?? `Brevo rejected this email (${response.status}).`,
        response.status === 425 || response.status === 429,
        response.status,
      );
    }
    const { error: sentReceiptError } = await supabaseAdmin
      .from("email_reminder_deliveries")
      .update({
        status: "sent",
        provider_status: response.status,
        provider_message_id: payload.messageId ?? null,
        delivered_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    if (sentReceiptError) {
      throw new ReminderDeliveryUncertainError(
        "Brevo accepted an email, but its delivery receipt could not be recorded.",
      );
    }
    return { skipped: false, sent: true, failed: false, retryable: false, errorMessage: null };
  } catch (reason) {
    if (reason instanceof ReminderDeliveryUncertainError) throw reason;
    const errorMessage = reason instanceof Error ? reason.message.slice(0, 500) : "Brevo rejected the delivery.";
    const retryable =
      reason instanceof EmailProviderError ? reason.retryable : false;
    const { error: failedReceiptError } = await supabaseAdmin
      .from("email_reminder_deliveries")
      .update({
        status: "failed",
        provider_status:
          reason instanceof EmailProviderError
            ? reason.providerStatus
            : null,
        error_message: errorMessage,
      })
      .eq("id", delivery.id);
    if (failedReceiptError) {
      throw new ReminderDeliveryUncertainError(
        "An email attempt finished, but its failure receipt could not be recorded.",
      );
    }
    return {
      skipped: false,
      sent: false,
      failed: true,
      retryable: retryable && delivery.attempt_count < MAX_EMAIL_ATTEMPTS,
      errorMessage,
    };
  }
}

export async function deliverEmailReminder(reminder: Reminder, limitedRecipients?: EmailRecipient[]) {
  let recipients: EmailRecipient[];
  try {
    if (reminder.category === "weekly_recap") reminder.recap_snapshot = await ensureWeeklyRecapSnapshot(reminder.id, reminder.recap_snapshot);
    if (reminder.category === "playoff_day_recap") reminder.recap_snapshot = await ensurePlayoffDayRecapSnapshot(reminder.id, reminder.recap_snapshot);
    if (reminder.category === "playoff_public_reveal") reminder.recap_snapshot = await ensurePlayoffPublicRevealSnapshot(reminder.id, reminder.recap_snapshot);
    if (reminder.category === "weekly") reminder.recap_snapshot = await ensureFreshSlateSnapshot(reminder.id, reminder.recap_snapshot);
    if (reminder.category === "final_lines" || reminder.category === "sunday_final_lines") reminder.recap_snapshot = await ensureGameDaySlateSnapshot(reminder.id, reminder.recap_snapshot);
    if (reminder.category === "early_lock") reminder.recap_snapshot = await ensureEarlyLockSnapshot(reminder.id, reminder.recap_snapshot);
    if (reminder.category === "sunday_early_reveal") reminder.recap_snapshot = await ensureSundayRevealSnapshot(reminder.id, reminder.recap_snapshot, "early");
    if (reminder.category === "sunday_late_reveal") reminder.recap_snapshot = await ensureSundayRevealSnapshot(reminder.id, reminder.recap_snapshot, "late");
    if (reminder.category === "featured_window_reveal") reminder.recap_snapshot = await ensureFeaturedWindowRevealSnapshot(reminder.id, reminder.recap_snapshot);
    recipients = limitedRecipients ?? await recipientsForReminder(reminder);
  } catch (reason) {
    throw new ReminderPreparationError(
      reason instanceof Error
        ? reason.message
        : "The email reminder could not be prepared.",
    );
  }
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let retryableFailed = 0;
  const errors: string[] = [];
  for (const recipient of recipients) {
    const result = await recordAndSend(reminder, recipient);
    sent += Number(result.sent);
    failed += Number(result.failed);
    skipped += Number(result.skipped);
    retryableFailed += Number(result.failed && result.retryable);
    if (result.errorMessage) errors.push(result.errorMessage);
  }
  return { recipients: recipients.length, sent, failed, skipped, retryableFailed, errors };
}

export async function deliverEmailTest(reminder: Reminder, playerId: string, email: string) {
  return deliverEmailReminder(reminder, [{ playerId, email }]);
}
