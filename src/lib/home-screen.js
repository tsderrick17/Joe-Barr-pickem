// @ts-check

/** How long "Not now" keeps the banner away. The card on the Notifications page is always there. */
export const BANNER_QUIET_DAYS = 14;

const OTHER_IPHONE_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|FBAN|FBAV|Instagram|Line\/|MicroMessenger/;

/**
 * What a visitor needs in order to put the pool on their Home Screen, from the few facts the page can read. Pure, so it can be tested without a phone.
 * - `installed`: already running as the Home Screen app, nothing to do.
 * - `iphone-safari`: Safari on an iPhone or iPad, which has no install button; the guide shows Share, then Add to Home Screen.
 * - `iphone-other-browser`: Chrome and the like on an iPhone. The Home Screen app that can receive notifications is the one added from Safari, so they are sent there.
 * - `android-prompt`: the browser handed over its own one-tap Install.
 * - `android-steps`: Android without that one-tap (Firefox, or the app is already installed): the menu steps.
 * - `none`: a computer.
 * @param {{ userAgent: string, platform?: string, maxTouchPoints?: number, standalone: boolean, canPrompt: boolean }} facts
 * @returns {"installed" | "iphone-safari" | "iphone-other-browser" | "android-prompt" | "android-steps" | "none"}
 */
export function homeScreenHelp({ userAgent, platform = "", maxTouchPoints = 0, standalone, canPrompt }) {
  if (standalone) return "installed";
  // An iPad in its desktop-sized mode reports itself as a Mac, with a touch screen.
  if (/iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)) {
    return OTHER_IPHONE_BROWSERS.test(userAgent) ? "iphone-other-browser" : "iphone-safari";
  }
  if (/Android/.test(userAgent)) return canPrompt ? "android-prompt" : "android-steps";
  return "none";
}

/**
 * Whether the slim banner shows. Android only gets it when the browser offers the one-tap Install, so a player who already installed the app is not nagged
 * from a browser tab; everyone is quiet for a while after "Not now".
 * @param {{ help: ReturnType<typeof homeScreenHelp>, dismissedAt: number | null, now: number }} facts
 */
export function homeScreenBannerVisible({ help, dismissedAt, now }) {
  if (help !== "iphone-safari" && help !== "iphone-other-browser" && help !== "android-prompt") return false;
  if (dismissedAt === null) return true;
  const since = now - dismissedAt;
  // "Not now" tapped a moment after the page loaded is a moment ahead of `now`; a time more than a day ahead means the phone's clock was moved,
  // and that must not keep the banner away for good.
  return since < -86_400_000 || since >= BANNER_QUIET_DAYS * 86_400_000;
}
