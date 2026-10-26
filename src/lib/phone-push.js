// @ts-check

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
