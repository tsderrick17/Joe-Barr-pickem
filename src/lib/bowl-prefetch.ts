/**
 * Standings shows the Bowl Card only after the main Standings data arrives, and the card then fetched its own data: two reads
 * one after the other before the football goes. When a device last showed the Bowl Card, its read now starts alongside the
 * main one and the card takes that same response, so the request count is unchanged and the wait is the longer of the two,
 * not their sum. A device that did not show the card last time (or has never visited) starts nothing early.
 */
const KEY = "pickem-bowl-card-shown";
const FRESH_MS = 15_000;
const REMOUNT_MS = 1_500;
let pending: { response: Promise<Response>; startedAt: number; takenAt?: number } | null = null;

/** Remember whether the Bowl Card was shown, so the next visit knows whether to start its read early. */
export function rememberBowlCard(shown: boolean) {
  try { window.localStorage.setItem(KEY, shown ? "1" : "0"); } catch { /* private mode: the card simply loads after the page, as before */ }
}

/** Start the Bowl Card's read now, but only if this device showed the card last time and nothing is already under way. */
export function startBowlPrefetch(read: () => Promise<Response>) {
  if (pending && Date.now() - pending.startedAt < FRESH_MS) return;
  try { if (window.localStorage.getItem(KEY) !== "1") return; } catch { return; }
  const response = read();
  response.catch(() => undefined);
  pending = { response, startedAt: Date.now() };
}

/**
 * The Bowl Card's early read. The card may ask twice in a moment (the browser re-runs its effect when a page remounts in development),
 * so asks in the first second and a half each get a copy of the same response; any later ask (a refresh) reads fresh.
 */
export function takeBowlPrefetch(): Promise<Response> | null {
  if (!pending) return null;
  const now = Date.now();
  if (now - pending.startedAt >= FRESH_MS || (pending.takenAt !== undefined && now - pending.takenAt >= REMOUNT_MS)) { pending = null; return null; }
  pending.takenAt ??= now;
  return pending.response.then((response) => response.clone());
}
