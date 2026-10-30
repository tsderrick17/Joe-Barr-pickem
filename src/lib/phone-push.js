// @ts-check

import { stillQuiet } from "./home-screen.js";

/**
 * What this browser can do about notifications, from the few facts the page can read. Pure, so it can be tested without a browser.
 * An iPhone browser tab has no notification support at all; the app added to the Home Screen does, which is why the two cases read differently.
 * @param {{ hasPush: boolean, isIPhone: boolean, standalone: boolean, permission: string, subscribed: boolean }} facts
 * @returns {"unsupported" | "not-installed" | "blocked" | "on" | "off"}
 */
export function phoneNotificationStatus({ hasPush, isIPhone, standalone, permission, subscribed }) {
  if (!hasPush) return isIPhone && !standalone ? "not-installed" : "unsupported";
  if (permission === "denied") return "blocked";
  return permission === "granted" && subscribed ? "on" : "off";
}

/**
 * The key a phone subscribes with, as the bytes the browser asks for (the server sends it as base64url text).
 * @param {string} publicKey
 */
export function applicationServerKey(publicKey) {
  const padded = publicKey.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(publicKey.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

/** "Not now" on the in-app banner keeps it away this long. */
export const NOTIFICATIONS_BANNER_QUIET_DAYS = 14;

/**
 * Whether the in-app "Turn on notifications" banner shows: in the app opened from the Home Screen, for a signed-in player whose phone can have
 * notifications but has not turned them on (a phone that said no is left alone; the Notifications page explains how to allow them). Not on the sign-in
 * page or the Notifications page (that page has its own button), and not for 14 days after "Not now".
 * @param {{ status: string, standalone: boolean, signedIn: boolean, path: string, dismissedAt: number | null, now: number }} facts
 */
export function notificationsBannerVisible({ status, standalone, signedIn, path, dismissedAt, now }) {
  if (!standalone || !signedIn || status !== "off") return false;
  if (path.startsWith("/login") || path.startsWith("/profile")) return false;
  return !stillQuiet(dismissedAt, now, NOTIFICATIONS_BANNER_QUIET_DAYS);
}

/**
 * Whether installing the app from the browser's one-tap Install (Android, Chromebook) should go straight on to ask for notifications, so one tap
 * does both. Only when the install went through, the phone can have notifications and has not been asked yet, and the player is signed in (the
 * phone is saved for them).
 * @param {{ outcome: string, hasPush: boolean, permission: string, signedIn: boolean }} facts
 */
export function askForNotificationsAfterInstall({ outcome, hasPush, permission, signedIn }) {
  return outcome === "accepted" && hasPush && permission === "default" && signedIn;
}
