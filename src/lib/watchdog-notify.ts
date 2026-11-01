import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPushToPlayers } from "@/lib/player-push";
import { noteOperationalWarning } from "@/lib/operational-warnings";

export type WatchdogSignal = { key: string; severity: "critical" | "warning"; title: string; detail: string };

/** A phone notification shows a few lines; the full wording is in the email and on the Commissioner Desk. */
const PHONE_BODY_LIMIT = 180;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

async function emailCommissioners(signal: WatchdogSignal, recipients: string[]) {
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  if (!key || !sender) throw new Error("Commissioner alert email is not configured.");
  if (!recipients.length) throw new Error("No commissioner notification email is configured.");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Joe Barr Pick'em Watchdog", email: sender },
      to: recipients.map((email) => ({ email })),
      subject: `[Pick'em action needed] ${signal.title}`,
      htmlContent: `<main style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h1>${escapeHtml(signal.title)}</h1><p>${escapeHtml(signal.detail)}</p><p><a href="https://pickemjb.vercel.app/admin">Open Commissioner Desk</a></p><p style="color:#57534e;font-size:12px">This alert is sent once per incident. It will not repeat unless the problem resolves and later returns.</p></main>`,
      textContent: `${signal.title}\n\n${signal.detail}\n\nOpen Commissioner Desk: https://pickemjb.vercel.app/admin\n\nThis alert is sent once per incident.`,
      tags: ["pickem-watchdog", signal.key],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Commissioner alert email was rejected (${response.status}).`);
  return recipients.length;
}

/** The same alert on the Commissioner's phone(s). A Commissioner who has not turned notifications on has no devices, which is not a failure. */
async function phoneCommissioners(signal: WatchdogSignal, playerIds: string[]) {
  const detail = `${signal.title}. ${signal.detail}`;
  const result = await sendPushToPlayers(playerIds, {
    title: "Pick'em action needed",
    body: detail.length > PHONE_BODY_LIMIT ? `${detail.slice(0, PHONE_BODY_LIMIT - 1)}…` : detail,
    url: "/admin",
    tag: `watchdog-${signal.key}`,
  });
  if (result.devices > 0 && result.sent === 0) throw new Error("The Commissioner's phone alert could not be delivered to any device.");
  return result.sent;
}

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Tells the Commissioner about a new incident by email and on their phone, each on its own so either can fail alone. The alert counts as delivered when
 * either got through; the one that failed is raised as a warning (Commissioner → Recent warnings) so a lapsed Brevo key or a dead phone subscription is
 * noticed. Only when both fail does this throw, and the watchdog then retries the alert.
 */
export async function notifyCommissioners(signal: WatchdogSignal) {
  const { data: commissioners, error } = await supabaseAdmin.from("players").select("id, notification_email").eq("active", true).eq("is_commissioner", true);
  if (error) throw new Error("Commissioner alert recipients could not be loaded.");
  const emails = [...new Set((commissioners ?? []).map((player) => player.notification_email).filter(Boolean))] as string[];
  const playerIds = (commissioners ?? []).map((player) => player.id);

  const [email, phone] = await Promise.allSettled([emailCommissioners(signal, emails), phoneCommissioners(signal, playerIds)]);
  const emailSent = email.status === "fulfilled";
  const phoneSent = phone.status === "fulfilled" && phone.value > 0;
  if (email.status === "rejected") await noteOperationalWarning("watchdog", "A watchdog alert email could not be sent.", { signalKey: signal.key, reason: reasonOf(email.reason) });
  if (phone.status === "rejected") await noteOperationalWarning("watchdog", "A watchdog alert phone notification could not be sent.", { signalKey: signal.key, reason: reasonOf(phone.reason) });
  if (email.status === "rejected" && !phoneSent) throw email.reason instanceof Error ? email.reason : new Error(reasonOf(email.reason));
  return emailSent ? email.value : phone.status === "fulfilled" ? phone.value : 0;
}
