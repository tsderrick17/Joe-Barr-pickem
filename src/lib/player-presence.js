// @ts-check
import { dateFormat } from "./date-format.js";

/** How many days the Players page counts visits over. */
export const VISIT_WINDOW_DAYS = 7;

const DAY = 86_400_000;

/**
 * The calendar day (in the pool's own time, Eastern) a moment falls on, as `2026-10-30`. A "day" for visits is an Eastern day, so a Sunday-night
 * game and the Monday after it count as two days for everyone, wherever they are.
 * @param {number} at
 */
export function easternDay(at) {
  return dateFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

/**
 * The first day the visit count looks at: today and the six days before it.
 * @param {number} now
 */
export function visitWindowStart(now) {
  return easternDay(now - (VISIT_WINDOW_DAYS - 1) * DAY);
}

/**
 * The device and browser a request came from, in plain words, from its User-Agent. Only fixed labels ever come out (never the raw text), so
 * nothing a visitor sends is stored. Anything not recognised is `null`.
 * @param {string | null | undefined} userAgent
 * @returns {{ device: string | null, browser: string | null }}
 */
export function describeDevice(userAgent) {
  const agent = userAgent ?? "";
  /** @type {string | null} */
  let device = null;
  if (/iPhone|iPod/.test(agent)) device = "iPhone";
  else if (/iPad/.test(agent)) device = "iPad";
  else if (/Android/.test(agent)) device = /Mobile/.test(agent) ? "Android phone" : "Android tablet";
  else if (/CrOS/.test(agent)) device = "Chromebook";
  else if (/Windows/.test(agent)) device = "Windows computer";
  else if (/Macintosh|Mac OS X/.test(agent)) device = "Mac";
  else if (/Linux|X11/.test(agent)) device = "Linux computer";

  /** @type {string | null} */
  let browser = null;
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(agent)) browser = "Facebook app";
  else if (/Instagram/.test(agent)) browser = "Instagram app";
  else if (/EdgA|EdgiOS|Edg\//.test(agent)) browser = "Edge";
  else if (/OPR\/|OPiOS|OPT\//.test(agent)) browser = "Opera";
  else if (/SamsungBrowser/.test(agent)) browser = "Samsung Internet";
  else if (/DuckDuckGo/.test(agent)) browser = "DuckDuckGo";
  else if (/CriOS|Chrome\//.test(agent)) browser = "Chrome";
  else if (/FxiOS|Firefox\//.test(agent)) browser = "Firefox";
  else if (/Safari\//.test(agent)) browser = "Safari";
  return { device, browser };
}

/**
 * What a request tells about the visit, ready to store: the device and browser labels, and whether it came from the installed app.
 * @param {{ userAgent: string | null | undefined, viaApp: boolean }} visit
 */
export function visitDetails({ userAgent, viaApp }) {
  const { device, browser } = describeDevice(userAgent);
  return { device, browser, viaApp };
}

/**
 * The line the Players page shows for where a player was last seen: "iPhone · Home Screen app", "Windows computer · Chrome".
 * @param {{ device: string | null | undefined, browser: string | null | undefined, viaApp: boolean | null | undefined }} seen
 * @returns {string | null}
 */
export function deviceSummary({ device, browser, viaApp }) {
  if (!device && !browser) return viaApp ? "The app" : null;
  const phone = device === "iPhone" || device === "iPad" || device === "Android phone" || device === "Android tablet";
  const how = viaApp ? (phone ? "Home Screen app" : "installed app") : browser;
  return [device, how].filter(Boolean).join(" · ");
}

/**
 * How long ago a player was last seen ("2h ago", or the date once it is two weeks back), for the Players page. Anyone who has never opened the pool says so.
 * @param {string | null | undefined} at
 * @param {number} now
 */
export function lastSeenLabel(at, now) {
  if (!at) return "Not yet signed in";
  const minutes = Math.max(0, Math.floor((now - new Date(at).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return dateFormat("en-US", { month: "short", day: "numeric" }).format(new Date(at));
}

/**
 * "5 of 7 days" for the week's visits; `null` when the count could not be loaded.
 * @param {number | null | undefined} days
 */
export function visitsLabel(days) {
  if (days === null || days === undefined) return null;
  return `${days} of ${VISIT_WINDOW_DAYS} days`;
}

/**
 * The totals across the pool for the strip at the top of the Players page. Only active players are counted.
 * @param {{ active: boolean, hasApp: boolean, notificationsOn: boolean | null, emailNotificationsEnabled: boolean, visitDays?: number | null }[]} players
 */
export function playerTotals(players) {
  const active = players.filter((player) => player.active);
  return {
    players: active.length,
    withApp: active.filter((player) => player.hasApp).length,
    withNotifications: active.filter((player) => player.notificationsOn).length,
    withEmails: active.filter((player) => player.emailNotificationsEnabled).length,
    quietThisWeek: active.filter((player) => player.visitDays === 0).length,
  };
}
