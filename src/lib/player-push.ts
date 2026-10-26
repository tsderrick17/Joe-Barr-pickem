import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { vapidKeys } from "@/lib/web-push-keys";

export type PushPayload = {
  title: string;
  body: string;
  /** Where tapping the notification opens, a path on this site. */
  url?: string;
  /** The number to show on the app icon (0 clears it). */
  badge?: number;
  /** A later notification with the same tag replaces the earlier one instead of stacking. */
  tag?: string;
};

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
type Send = typeof webpush.sendNotification;

/** Whoever the push services see as the sender: a web address for the pool. */
const VAPID_SUBJECT = "https://pickemjb.vercel.app";

/** "gone" means the push service no longer knows the device (404 or 410), so the subscription should be deleted. */
export async function sendWebPush(subscription: Subscription, payload: PushPayload, send: Send = webpush.sendNotification.bind(webpush)): Promise<"sent" | "gone" | "failed"> {
  const keys = await vapidKeys();
  try {
    await send(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      { vapidDetails: { subject: VAPID_SUBJECT, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 3600, urgency: "normal", timeout: 8000 },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}

/** Sends one notification to every device the player turned notifications on for, and forgets the devices the push service says are gone. */
export async function sendPushToPlayer(playerId: string, payload: PushPayload, send?: Send) {
  const { data, error } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("player_id", playerId);
  if (error) throw new Error("The player's devices could not be read.");
  const outcomes = await Promise.all((data ?? []).map(async (subscription) => ({ subscription, outcome: await sendWebPush(subscription, payload, send) })));
  const gone = outcomes.filter((result) => result.outcome === "gone").map((result) => result.subscription.id);
  if (gone.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", gone);
  return {
    devices: outcomes.length,
    sent: outcomes.filter((result) => result.outcome === "sent").length,
    failed: outcomes.filter((result) => result.outcome === "failed").length,
    removed: gone.length,
  };
}
