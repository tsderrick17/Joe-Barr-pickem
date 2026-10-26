import assert from "node:assert/strict";
import test from "node:test";
import { BANNER_QUIET_DAYS, homeScreenBannerVisible, homeScreenHelp } from "../src/lib/home-screen.js";

// What a visitor needs in order to put the pool on their Home Screen: which kind of phone and browser it is, and when the slim banner shows.
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1";
const IPHONE_FIREFOX = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15";
const IPHONE_EDGE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/130.0.2849.80 Version/18.0 Mobile/15E148 Safari/605.1.15";
const IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const WINDOWS_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

const help = (userAgent, rest = {}) => homeScreenHelp({ userAgent, standalone: false, canPrompt: false, ...rest });

test("an iPhone in Safari is walked through Share, then Add to Home Screen", () => {
  assert.equal(help(SAFARI), "iphone-safari");
  assert.equal(help(SAFARI, { canPrompt: true }), "iphone-safari", "an iPhone has no one-tap install, whatever the page was offered");
});

test("an iPhone in Chrome, Firefox, Edge or an in-app browser is sent to Safari, the only place the app that gets notifications is added from", () => {
  for (const userAgent of [IPHONE_CHROME, IPHONE_FIREFOX, IPHONE_EDGE, IPHONE_INSTAGRAM]) assert.equal(help(userAgent), "iphone-other-browser", userAgent);
});

test("an iPad asking for the desktop site (it calls itself a Mac, with a touch screen) is treated as an iPhone-style Safari, and a real Mac is not", () => {
  assert.equal(help(MAC_SAFARI, { platform: "MacIntel", maxTouchPoints: 5 }), "iphone-safari");
  assert.equal(help(MAC_SAFARI, { platform: "MacIntel", maxTouchPoints: 0 }), "none");
});

test("Android gets the one-tap Install when the browser offered it, and the menu steps when it did not", () => {
  assert.equal(help(ANDROID_CHROME, { canPrompt: true }), "android-prompt");
  assert.equal(help(ANDROID_CHROME), "android-steps");
});

test("a computer is left alone", () => {
  assert.equal(help(WINDOWS_CHROME), "none");
  assert.equal(help(WINDOWS_CHROME, { canPrompt: true }), "none", "the browser's own install button on a computer is not ours to push");
});

test("the Home Screen app itself is already installed, on every kind of phone", () => {
  for (const userAgent of [SAFARI, IPHONE_CHROME, ANDROID_CHROME, WINDOWS_CHROME]) assert.equal(help(userAgent, { standalone: true, canPrompt: true }), "installed", userAgent);
});

const NOW = Date.parse("2026-10-26T12:00:00Z");
const DAY = 86_400_000;

test("the banner shows on an iPhone or when Android offers the install, never on a computer, the installed app or Android without the offer", () => {
  const visible = (kind, dismissedAt = null) => homeScreenBannerVisible({ help: kind, dismissedAt, now: NOW });
  assert.equal(visible("iphone-safari"), true);
  assert.equal(visible("iphone-other-browser"), true);
  assert.equal(visible("android-prompt"), true);
  assert.equal(visible("android-steps"), false, "a player who installed the app and then opens a browser tab is not nagged");
  assert.equal(visible("installed"), false);
  assert.equal(visible("none"), false);
});

test("'Not now' keeps the banner away for two weeks, then it comes back once", () => {
  const visible = (dismissedAt) => homeScreenBannerVisible({ help: "iphone-safari", dismissedAt, now: NOW });
  assert.equal(BANNER_QUIET_DAYS, 14);
  assert.equal(visible(NOW), false);
  assert.equal(visible(NOW - 13 * DAY), false);
  assert.equal(visible(NOW - 14 * DAY), true);
  assert.equal(visible(NOW + 5_000), false, "'Not now' tapped seconds after the page loaded counts as just now");
  assert.equal(visible(NOW + 3 * DAY), true, "a time well in the future (the phone's clock was moved) does not hide the banner for good");
});
