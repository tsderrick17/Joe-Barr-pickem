// @ts-check
import { createHmac } from "node:crypto";

export const PLAYER_AUTH_CREDENTIAL_VERSION = 2;

/** @param {string} pin */
export function playerAuthEmail(pin) {
  return `pin-${pin}@pickemjb.app`;
}

/** @param {string} pin @param {string} serverSecret */
export function derivePlayerAuthPassword(pin, serverSecret) {
  if (!/^\d{4}$/.test(pin)) throw new Error("A four-digit PIN is required.");
  if (serverSecret.length < 32) throw new Error("A strong server credential is required.");

  const digest = createHmac("sha256", serverSecret)
    .update(`pickem-player-auth-v${PLAYER_AUTH_CREDENTIAL_VERSION}:${pin}`)
    .digest("base64url");

  return `P${PLAYER_AUTH_CREDENTIAL_VERSION}!${digest}`;
}

/** @param {string} pin */
export function legacyPlayerAuthPassword(pin) {
  return `pickem-${pin}`;
}
