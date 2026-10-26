// @ts-check

/** How long "Not now" keeps the banner away. The card on the Notifications page is always there. */
export const BANNER_QUIET_DAYS = 14;
/** How long "I already have it" keeps the banner away (an iPhone's Safari cannot see the Home Screen app, so it cannot know). */
export const HAVE_IT_QUIET_DAYS = 180;

const DAY = 86_400_000;
// Apps that open links in their own window (Facebook, Instagram, Messenger, the Google app, Gmail and the like). They cannot add anything to the Home Screen.
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|MicroMessenger|Snapchat|Twitter|LinkedInApp|Pinterest|GSA\//;
// Browsers on an iPhone that have their own Share button with Add to Home Screen (iOS 16.4 and later).
const IPHONE_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|Brave/;

/**
 * What a visitor needs in order to put the pool on their Home Screen, from the few facts the page can read. Pure, so it can be tested without a phone.
 * - `installed`: running as the Home Screen app. `installed-tab`: a browser tab on a phone known to have the app (Android can tell).
 * - `iphone-safari`: Safari on an iPhone or iPad: Share, then Add to Home Screen.
 * - `iphone-browser`: Chrome, Edge, Firefox and the like on an iPhone: their own Share button, then Add to Home Screen.
 * - `iphone-in-app` / `android-in-app`: a link opened inside another app's window, which cannot add to the Home Screen: open it in Safari or Chrome first.
 * - `android-prompt`: the browser handed over its own one-tap Install. `android-steps`: Android without it (yet): the browser menu steps.
 * - `chromebook-prompt` / `chromebook-steps`: the same for Chrome on a Chromebook, where the app opens in its own window from the launcher.
 * - `none`: any other computer.
 * @param {{ userAgent: string, platform?: string, maxTouchPoints?: number, standalone: boolean, canPrompt: boolean, installedHere?: boolean }} facts
 * @returns {"installed" | "installed-tab" | "iphone-safari" | "iphone-browser" | "iphone-in-app" | "android-prompt" | "android-steps" | "android-in-app" | "chromebook-prompt" | "chromebook-steps" | "none"}
 */
export function homeScreenHelp({ userAgent, platform = "", maxTouchPoints = 0, standalone, canPrompt, installedHere = false }) {
  if (standalone) return "installed";
  // An iPad in its desktop-sized mode reports itself as a Mac, with a touch screen.
  if (/iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)) {
    if (installedHere) return "installed-tab";
    if (IN_APP.test(userAgent)) return "iphone-in-app";
    if (IPHONE_BROWSERS.test(userAgent)) return "iphone-browser";
    // Safari names itself; a page shown inside some other app's window (Gmail, a bank's app) does not.
    return /Safari\//.test(userAgent) ? "iphone-safari" : "iphone-in-app";
  }
  if (/Android/.test(userAgent)) {
    if (installedHere) return "installed-tab";
    if (IN_APP.test(userAgent) || /; wv\)/.test(userAgent)) return "android-in-app";
    return canPrompt ? "android-prompt" : "android-steps";
  }
  if (/CrOS/.test(userAgent)) {
    if (installedHere) return "installed-tab";
    return canPrompt ? "chromebook-prompt" : "chromebook-steps";
  }
  return "none";
}

/**
 * Which Android browser's menu to describe.
 * @param {string} userAgent
 * @returns {"samsung" | "firefox" | "chrome"}
 */
export function androidBrowser(userAgent) {
  if (/SamsungBrowser/.test(userAgent)) return "samsung";
  if (/Firefox\//.test(userAgent)) return "firefox";
  return "chrome";
}

/** @param {number | null} at @param {number} now @param {number} days */
function stillQuiet(at, now, days) {
  if (at === null) return false;
  const since = now - at;
  // A tap a moment after the page loaded is a moment ahead of `now`; a time more than a day ahead means the phone's clock was moved,
  // and that must not keep the banner away for good.
  return since >= -DAY && since < days * DAY;
}

/**
 * Whether the slim banner shows: on any phone that is not running the Home Screen app and not known to have it, unless "Not now" (14 days) or
 * "I already have it" (180 days) was tapped.
 * @param {{ help: ReturnType<typeof homeScreenHelp>, dismissedAt: number | null, haveItAt?: number | null, now: number }} facts
 */
export function homeScreenBannerVisible({ help, dismissedAt, haveItAt = null, now }) {
  if (help === "installed" || help === "installed-tab" || help === "none") return false;
  return !stillQuiet(dismissedAt, now, BANNER_QUIET_DAYS) && !stillQuiet(haveItAt, now, HAVE_IT_QUIET_DAYS);
}
