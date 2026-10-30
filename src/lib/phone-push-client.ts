import { fetchWithSession, getFreshSession } from "@/lib/auth-session";
import { applicationServerKey, askForNotificationsAfterInstall } from "@/lib/phone-push.js";

const jsonHeaders = { "Content-Type": "application/json" };

/** What this browser can tell about notifications: the facts `phoneNotificationStatus` reads. */
export function readPhoneFacts() {
  const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return { hasPush, isIPhone, standalone, permission: hasPush ? Notification.permission : "default" };
}

export async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function failureMessage(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}

/** Saves this phone's subscription for the signed-in player (again is harmless: a browser can replace it without telling anyone). */
export function saveSubscription(subscription: PushSubscription) {
  return fetchWithSession("/api/push/subscription", { method: "PUT", headers: jsonHeaders, body: JSON.stringify(subscription.toJSON()) });
}

export function forgetSubscription(endpoint: string) {
  return fetchWithSession("/api/push/subscription", { method: "DELETE", headers: jsonHeaders, body: JSON.stringify({ endpoint }) });
}

/**
 * Turns notifications on for this phone, from a tap: asks the phone, subscribes with the pool's key and saves the phone. The Notifications card and the
 * in-app banner both use this one path. Throws with a message a player can read when something on the way fails.
 */
export async function turnOnPhoneNotifications(): Promise<"on" | "blocked" | "off"> {
  // The permission question has to be asked straight from the tap, before anything else is waited on.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const keyResponse = await fetchWithSession("/api/push/key");
  if (!keyResponse.ok) throw new Error(await failureMessage(keyResponse, "Notifications are not available right now."));
  const { publicKey } = await keyResponse.json() as { publicKey: string };
  const subscription = (await registration.pushManager.getSubscription()) ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
  const saved = await saveSubscription(subscription);
  if (!saved.ok) throw new Error(await failureMessage(saved, "Notifications could not be turned on."));
  return "on";
}

/**
 * Right after the browser's one-tap Install went through: ask for notifications too, so one button does both. Quietly does nothing when it should
 * not ask or when anything fails; the in-app banner offers it again the first time the app opens.
 */
export async function turnOnAfterInstall(outcome: string) {
  const facts = readPhoneFacts();
  if (!facts.hasPush || facts.permission !== "default") return;
  const session = await getFreshSession().catch(() => null);
  if (!askForNotificationsAfterInstall({ outcome, hasPush: facts.hasPush, permission: facts.permission, signedIn: session !== null })) return;
  await turnOnPhoneNotifications().catch(() => undefined);
}
