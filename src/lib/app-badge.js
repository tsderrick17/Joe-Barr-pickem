// @ts-check

/** Announced after picks are saved, so the icon number drops straight away. */
export const PICKS_SAVED_EVENT = "pickem:picks-saved";

/** Coming back to the app re-reads the number, but not more than once a minute. */
const REFRESH_AFTER_MS = 60_000;

/**
 * @param {number} lastReadAt when the number was last read (ms)
 * @param {number} now ms
 */
export function badgeRefreshDue(lastReadAt, now) {
  return now - lastReadAt >= REFRESH_AFTER_MS || now < lastReadAt;
}
