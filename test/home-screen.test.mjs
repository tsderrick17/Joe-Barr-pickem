import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { BANNER_QUIET_DAYS, androidBrowser, homeScreenBannerVisible, homeScreenHelp } from "../src/lib/home-screen.js";

// What a visitor needs in order to put the pool on their Home Screen: which kind of phone and browser it is, when the slim banner shows, and the
// manifest every phone reads when it installs the app. The browser names are real ones as each browser sends them.
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const SAFARI = `${IOS} Version/18.0 Mobile/15E148 Safari/604.1`;
const IPAD_SAFARI = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = `${IOS} CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1`;
const IPHONE_FIREFOX = `${IOS} FxiOS/131.0 Mobile/15E148 Safari/605.1.15`;
const IPHONE_EDGE = `${IOS} EdgiOS/130.0.2849.80 Version/18.0 Mobile/15E148 Safari/605.1.15`;
const IPHONE_FACEBOOK = `${IOS} Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.40.104;FBBV/650000000]`;
const IPHONE_INSTAGRAM = `${IOS} Mobile/15E148 Instagram 350.0.0.30.89 (iPhone15,2; iOS 18_0; en_US)`;
const IPHONE_GOOGLE_APP = `${IOS} GSA/340.0.689425558 Mobile/15E148 Safari/604.1`;
const IPHONE_GMAIL = `${IOS} Mobile/15E148`;   // a page shown inside another app's own window: no "Safari"
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko)";
const ANDROID_CHROME = `${ANDROID} Chrome/130.0.0.0 Mobile Safari/537.36`;
const ANDROID_SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36";
const ANDROID_FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0";
const ANDROID_FACEBOOK = `${ANDROID} Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.40.104;]`;
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36";
const CHROMEBOOK = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const WINDOWS_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const help = (userAgent, rest = {}) => homeScreenHelp({ userAgent, standalone: false, canPrompt: false, ...rest });

test("Safari on an iPhone or iPad is walked through Share, then Add to Home Screen", () => {
  assert.equal(help(SAFARI), "iphone-safari");
  assert.equal(help(IPAD_SAFARI), "iphone-safari");
  assert.equal(help(SAFARI, { canPrompt: true }), "iphone-safari", "an iPhone has no one-tap install, whatever the page was offered");
});

test("Chrome, Firefox and Edge on an iPhone get their own Share button's steps (they can add to the Home Screen since iOS 16.4)", () => {
  for (const userAgent of [IPHONE_CHROME, IPHONE_FIREFOX, IPHONE_EDGE]) assert.equal(help(userAgent), "iphone-browser", userAgent);
});

test("a link opened inside Facebook, Instagram, the Google app or Gmail on an iPhone is sent to Safari first", () => {
  for (const userAgent of [IPHONE_FACEBOOK, IPHONE_INSTAGRAM, IPHONE_GOOGLE_APP, IPHONE_GMAIL]) assert.equal(help(userAgent), "iphone-in-app", userAgent);
});

test("an iPad asking for the desktop site (it calls itself a Mac, with a touch screen) is treated as Safari on a phone, and a real Mac is not", () => {
  assert.equal(help(MAC_SAFARI, { platform: "MacIntel", maxTouchPoints: 5 }), "iphone-safari");
  assert.equal(help(MAC_SAFARI, { platform: "MacIntel", maxTouchPoints: 0 }), "none");
});

test("Android gets the one-tap Install when the browser offered it, and the menu steps until then", () => {
  assert.equal(help(ANDROID_CHROME, { canPrompt: true }), "android-prompt");
  assert.equal(help(ANDROID_CHROME), "android-steps");
  assert.equal(help(ANDROID_SAMSUNG), "android-steps");
  assert.equal(help(ANDROID_FIREFOX), "android-steps");
});

test("a link opened inside Facebook or another app's window on Android is sent to Chrome first", () => {
  assert.equal(help(ANDROID_FACEBOOK, { canPrompt: true }), "android-in-app");
  assert.equal(help(ANDROID_WEBVIEW), "android-in-app");
});

test("the steps follow the Android browser's own menu", () => {
  assert.equal(androidBrowser(ANDROID_CHROME), "chrome");
  assert.equal(androidBrowser(ANDROID_SAMSUNG), "samsung");
  assert.equal(androidBrowser(ANDROID_FIREFOX), "firefox");
});

test("the Home Screen app itself is installed on every kind of phone; a browser tab on a phone known to have it says so", () => {
  for (const userAgent of [SAFARI, IPHONE_CHROME, ANDROID_CHROME, ANDROID_FACEBOOK]) assert.equal(help(userAgent, { standalone: true, canPrompt: true }), "installed", userAgent);
  assert.equal(help(ANDROID_CHROME, { installedHere: true, canPrompt: true }), "installed-tab");
  assert.equal(help(ANDROID_SAMSUNG, { installedHere: true }), "installed-tab");
});

test("a Chromebook gets Chrome's one-tap Install when offered and the menu steps until then, and the app opened there before counts", () => {
  assert.equal(help(CHROMEBOOK, { canPrompt: true }), "chromebook-prompt");
  assert.equal(help(CHROMEBOOK), "chromebook-steps");
  assert.equal(help(CHROMEBOOK, { installedHere: true }), "installed-tab");
  assert.equal(help(CHROMEBOOK, { standalone: true }), "installed");
});

test("any other computer is left alone", () => {
  assert.equal(help(WINDOWS_CHROME), "none");
  assert.equal(help(WINDOWS_CHROME, { canPrompt: true }), "none", "the browser's own install button on a computer is not ours to push");
  assert.equal(help(WINDOWS_CHROME, { installedHere: true }), "none");
});

const NOW = Date.parse("2026-10-26T12:00:00Z");
const DAY = 86_400_000;
const visible = (kind, rest = {}) => homeScreenBannerVisible({ help: kind, dismissedAt: null, now: NOW, ...rest });

test("the banner shows on every phone and Chromebook that needs it, never on a computer, the installed app or a tab on a phone known to have it", () => {
  for (const kind of ["iphone-safari", "iphone-browser", "iphone-in-app", "android-prompt", "android-steps", "android-in-app", "chromebook-prompt", "chromebook-steps"]) assert.equal(visible(kind), true, kind);
  for (const kind of ["installed", "installed-tab", "none"]) assert.equal(visible(kind), false, kind);
});

test("'Not now' keeps the banner away for two weeks, then it comes back", () => {
  assert.equal(BANNER_QUIET_DAYS, 14);
  assert.equal(visible("iphone-safari", { dismissedAt: NOW }), false);
  assert.equal(visible("iphone-safari", { dismissedAt: NOW + 5_000 }), false, "'Not now' tapped seconds after the page loaded counts as just now");
  assert.equal(visible("iphone-safari", { dismissedAt: NOW - 13 * DAY }), false);
  assert.equal(visible("iphone-safari", { dismissedAt: NOW - 14 * DAY }), true);
  assert.equal(visible("iphone-safari", { dismissedAt: NOW + 3 * DAY }), true, "a time well in the future (the phone's clock was moved) does not hide the banner for good");
});

test("the manifest has everything a phone needs to install the app, keeps the identity earlier installs have, and lets Android check for it", async () => {
  const { default: manifest } = await import("../src/app/manifest.ts");
  const app = manifest();
  assert.ok(app.name && app.short_name);
  assert.equal(app.start_url, "/");
  assert.equal(app.id, "/", "the id browsers computed from start_url before it was written down");
  assert.equal(app.display, "standalone");
  assert.notEqual(app.prefer_related_applications, true, "true would make Chrome stop offering the install");
  const sizes = app.icons.filter((icon) => icon.purpose !== "maskable").map((icon) => icon.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"), "Chrome needs a 192 and a 512 icon");
  assert.deepEqual(app.related_applications, [{ platform: "webapp", url: "/manifest.webmanifest" }]);
});
