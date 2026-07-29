import { eligiblePlayerIds, ReminderCategory, ReminderAudience } from "@/lib/push-reminders";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ensureWeeklyRecapSnapshot } from "@/lib/weekly-recap";

type Reminder = {
  id: string;
  category: ReminderCategory;
  audience: ReminderAudience;
  title: string;
  body: string;
  recap_snapshot?: unknown;
};

type EmailRecipient = {
  playerId: string;
  email: string;
};

function preferenceColumn(category: ReminderCategory) {
  return {
    weekly: "email_weekly_enabled",
    final_lines: "email_final_lines_enabled",
    pick_due: "email_pick_due_enabled",
    weekly_recap: "email_weekly_recap_enabled",
    ats_due: "email_ats_due_enabled",
    survivor_due: "email_survivor_due_enabled",
    custom: "email_custom_enabled",
  }[category];
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function messageHtml(reminder: Reminder) {
  const recapImages = reminder.category === "weekly_recap"
    ? `<div style="margin-top:28px"><img alt="Final Slate" src="https://pickemjb.vercel.app/api/recap-image?reminder=${encodeURIComponent(reminder.id)}&kind=slate" style="display:block;height:auto;margin:0 0 18px;width:100%"><img alt="Standings and Survivor recap" src="https://pickemjb.vercel.app/api/recap-image?reminder=${encodeURIComponent(reminder.id)}&kind=standings" style="display:block;height:auto;width:100%"></div>`
    : "";
  return `<main style="font-family:Georgia,serif;color:#171719;max-width:600px;margin:0 auto;padding:24px"><p style="font:700 12px Arial,sans-serif;letter-spacing:.16em;color:#475569">JOE BARR MEMORIAL PICK'EM</p><h1 style="font-size:28px;margin:8px 0 16px">${escapeHtml(reminder.title)}</h1><p style="font:18px/1.5 Arial,sans-serif">${escapeHtml(reminder.body)}</p>${recapImages}<p style="margin-top:24px"><a href="https://pickemjb.vercel.app" style="display:inline-block;background:#1d1d1f;color:#fff;padding:12px 18px;text-decoration:none;font:700 15px Arial,sans-serif">Open Pick'em</a></p><hr style="border:0;border-top:1px solid #d6d3d1;margin:28px 0 16px"><p style="font:12px/1.5 Arial,sans-serif;color:#57534e">You received this because you opted into Joe Barr Memorial Pick'em email reminders. Change your choices in Preferences.</p></main>`;
}

async function recipientsForReminder(reminder: Reminder) {
  const playerIds = await eligiblePlayerIds(reminder.audience);
  if (playerIds.length === 0) return [] as EmailRecipient[];
  const preference = preferenceColumn(reminder.category);
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
  const { data: delivery, error: createError } = await supabaseAdmin
    .from("email_reminder_deliveries")
    .insert({ reminder_id: reminder.id, player_id: recipient.playerId, email_address: recipient.email })
    .select("id")
    .maybeSingle();
  if (createError?.code === "23505") return { skipped: true, sent: false, failed: false };
  if (createError || !delivery) throw new Error("An email delivery receipt could not be created.");

  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  if (!key || !sender) {
    await supabaseAdmin.from("email_reminder_deliveries").update({
      status: "failed",
      error_message: "Email sender setup is incomplete.",
    }).eq("id", delivery.id);
    return { skipped: false, sent: false, failed: true };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Joe Barr Memorial Pick'em", email: sender },
        to: [{ email: recipient.email }],
        subject: reminder.title,
        htmlContent: messageHtml(reminder),
        textContent: `${reminder.title}\n\n${reminder.body}\n\nOpen Pick'em: https://pickemjb.vercel.app`,
        tags: ["pickem-reminder", reminder.category],
      }),
    });
    const payload = await response.json().catch(() => ({})) as { messageId?: string; code?: string; message?: string };
    if (!response.ok) throw new Error(payload.message ?? `Brevo rejected this email (${response.status}).`);
    await supabaseAdmin.from("email_reminder_deliveries").update({
      status: "sent",
      provider_status: response.status,
      provider_message_id: payload.messageId ?? null,
      delivered_at: new Date().toISOString(),
    }).eq("id", delivery.id);
    return { skipped: false, sent: true, failed: false };
  } catch (reason) {
    await supabaseAdmin.from("email_reminder_deliveries").update({
      status: "failed",
      error_message: reason instanceof Error ? reason.message.slice(0, 500) : "Brevo rejected the delivery.",
    }).eq("id", delivery.id);
    return { skipped: false, sent: false, failed: true };
  }
}

export async function deliverEmailReminder(reminder: Reminder, limitedRecipients?: EmailRecipient[]) {
  if (reminder.category === "weekly_recap") reminder.recap_snapshot = await ensureWeeklyRecapSnapshot(reminder.id, reminder.recap_snapshot);
  const recipients = limitedRecipients ?? await recipientsForReminder(reminder);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const recipient of recipients) {
    const result = await recordAndSend(reminder, recipient);
    sent += Number(result.sent);
    failed += Number(result.failed);
    skipped += Number(result.skipped);
  }
  return { recipients: recipients.length, sent, failed, skipped };
}

export async function deliverEmailTest(reminder: Reminder, playerId: string, email: string) {
  return deliverEmailReminder(reminder, [{ playerId, email }]);
}
