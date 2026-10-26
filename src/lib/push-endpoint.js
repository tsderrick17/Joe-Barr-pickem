// @ts-check

/** The push services a browser can hand a subscription to: Apple (every iPhone browser), Google, Mozilla and Microsoft. */
const PUSH_HOSTS = [
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * Whether `value` is a plausible push endpoint. The server posts to this address when it sends, so it must be a plain https address on a
 * known push service, never an arbitrary address a signed-in player typed in.
 * @param {unknown} value
 */
export function isPushEndpoint(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 1000) return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  return PUSH_HOSTS.some((pattern) => pattern.test(url.hostname));
}

/**
 * The browser's subscription as { endpoint, keys: { p256dh, auth } }, checked field by field; null when anything is missing or malformed.
 * @param {unknown} body
 * @returns {{ endpoint: string, p256dh: string, auth: string } | null}
 */
export function readSubscription(body) {
  if (typeof body !== "object" || body === null) return null;
  const { endpoint, keys } = /** @type {Record<string, unknown>} */ (body);
  if (!isPushEndpoint(endpoint) || typeof keys !== "object" || keys === null) return null;
  const { p256dh, auth } = /** @type {Record<string, unknown>} */ (keys);
  if (typeof p256dh !== "string" || !BASE64URL.test(p256dh) || p256dh.length < 80 || p256dh.length > 100) return null;
  if (typeof auth !== "string" || !BASE64URL.test(auth) || auth.length < 16 || auth.length > 40) return null;
  return { endpoint: /** @type {string} */ (endpoint), p256dh, auth };
}
