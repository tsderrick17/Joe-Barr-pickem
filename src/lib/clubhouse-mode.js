/**
 * How the Commissioner's clubhouse behaves as a place to live in, not just a page:
 *  - the light switch is a mode that is remembered on this device (switch up: opening the app lands in the clubhouse);
 *  - the pop-ups open over the room, each with its own address (#slate, #survivor...) so the phone's back gesture closes it,
 *    a reload comes back to it, and a link to another page opens its pop-up in place instead of leaving the screen.
 */

export const MODE_KEY = "pickem-clubhouse-mode";

/** The real page each pane shows, by its path. */
export const PANE_PATHS = { "/": "standings", "/board": "slate", "/trophy-room": "trophies", "/bowl-pool": "bowl" };
export const PANES = ["standings", "slate", "survivor", "trophies", "bowl", "rules"];

/** The pane a link opens in place, or null when it is a link out of the clubhouse (the profile, the Commissioner's pages). */
export function paneForHref(href, origin) {
  let url;
  try { url = new URL(href, origin); } catch { return null; }
  if (url.origin !== origin) return null;
  if (url.pathname === "/clubhouse/rules") return "rules";
  return PANE_PATHS[url.pathname] ?? null;
}

/** The pane an address's #hash names (#slate), or null for the room itself. */
export function paneFromHash(hash) {
  const name = String(hash ?? "").replace(/^#/, "");
  return PANES.includes(name) ? name : null;
}

/** Whether the clubhouse is the remembered mode on this device. Storage can be blocked, so a failure reads as "classic". */
export function clubhouseModeOn() {
  try { return window.localStorage.getItem(MODE_KEY) === "on"; } catch { return false; }
}

export function setClubhouseMode(on) {
  try { window.localStorage.setItem(MODE_KEY, on ? "on" : "off"); } catch { /* the mode simply is not remembered */ }
}
