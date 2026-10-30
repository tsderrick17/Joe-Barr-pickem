import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";

// "Add to Home Screen": the slim banner under the header of every page and the card on the Notifications page. The browser is made to look like each kind of
// phone and browser (Safari, Chrome and Facebook's window on an iPhone; Chrome, Samsung Internet, Firefox and Facebook's window on Android, with and
// without the browser's one-tap Install; the installed app; a computer), so every state can be shown as it reads and the taps (Show me how, Install,
// Copy link, Not now, I already have it) can be followed. Nothing is ever really installed.
const WIDTHS = { "phone-360": 360, "phone-390": 390 } as const;
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const CROS = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko)";

type Phone = "iphone-safari" | "iphone-chrome" | "iphone-facebook" | "android-prompt" | "android-chrome" | "android-samsung" | "android-firefox" | "android-facebook"
  | "android-installed" | "android-silent" | "chromebook-prompt" | "chromebook" | "chromebook-installed" | "installed" | "desktop";
type Script = { userAgent?: string; platform?: string; standalone?: boolean; related?: "installed" | "not-installed" | "never-answers" };
const PHONES: Record<Phone, Script & { help: string }> = {
  "iphone-safari": { userAgent: `${IOS} Version/18.0 Mobile/15E148 Safari/604.1`, platform: "iPhone", help: "iphone-safari" },
  "iphone-chrome": { userAgent: `${IOS} CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1`, platform: "iPhone", help: "iphone-browser" },
  "iphone-facebook": { userAgent: `${IOS} Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.40.104]`, platform: "iPhone", help: "iphone-in-app" },
  "android-prompt": { userAgent: `${ANDROID} Chrome/130.0.0.0 Mobile Safari/537.36`, platform: "Linux armv81", related: "not-installed", help: "android-prompt" },
  "android-chrome": { userAgent: `${ANDROID} Chrome/130.0.0.0 Mobile Safari/537.36`, platform: "Linux armv81", related: "not-installed", help: "android-steps" },
  "android-samsung": { userAgent: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36", platform: "Linux armv81", help: "android-steps" },
  "android-firefox": { userAgent: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0", platform: "Linux armv81", help: "android-steps" },
  "android-facebook": { userAgent: `${ANDROID} Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.40.104;]`, platform: "Linux armv81", help: "android-in-app" },
  "android-installed": { userAgent: `${ANDROID} Chrome/130.0.0.0 Mobile Safari/537.36`, platform: "Linux armv81", related: "installed", help: "installed-tab" },
  "android-silent": { userAgent: `${ANDROID} Chrome/130.0.0.0 Mobile Safari/537.36`, platform: "Linux armv81", related: "never-answers", help: "android-steps" },
  "chromebook-prompt": { userAgent: CROS, platform: "Linux x86_64", help: "chromebook-prompt" },
  chromebook: { userAgent: CROS, platform: "Linux x86_64", help: "chromebook-steps" },
  "chromebook-installed": { userAgent: CROS, platform: "Linux x86_64", related: "not-installed", help: "installed-tab" },
  installed: { userAgent: `${IOS} Version/18.0 Mobile/15E148 Safari/604.1`, platform: "iPhone", standalone: true, help: "installed" },
  desktop: { help: "none" },
};


type Planted = { dismissedDaysAgo?: number; haveItDaysAgo?: number; openedAsAppBefore?: boolean };

/** Makes the browser look like one kind of phone, before the page runs, with any earlier taps planted in its storage. */
async function scriptPhone(page: Page, phone: Phone, planted: Planted = {}) {
  await page.addInitScript(([script, earlier]) => {
    const { userAgent, platform, standalone, related } = script as Script;
    const { dismissedDaysAgo, haveItDaysAgo, openedAsAppBefore } = earlier as Planted;
    if (userAgent) Object.defineProperty(navigator, "userAgent", { get: () => userAgent, configurable: true });
    if (platform) Object.defineProperty(navigator, "platform", { get: () => platform, configurable: true });
    if (standalone) Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    // Chrome on Android answers whether the app is on the phone; other browsers have no way to ask.
    if (related) Object.defineProperty(navigator, "getInstalledRelatedApps", { value: () => related === "never-answers" ? new Promise(() => {}) : Promise.resolve(related === "installed" ? [{ platform: "webapp" }] : []), configurable: true });
    else delete (Navigator.prototype as { getInstalledRelatedApps?: unknown }).getInstalledRelatedApps;
    const copied: string[] = [];
    (window as unknown as { copied: string[] }).copied = copied;
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => { copied.push(text); } }, configurable: true });
    const daysAgo = (days: number) => String(Date.now() - days * 86_400_000);
    if (typeof dismissedDaysAgo === "number") window.localStorage.setItem("pickem-home-screen-dismissed", daysAgo(dismissedDaysAgo));
    if (typeof haveItDaysAgo === "number") window.localStorage.setItem("pickem-home-screen-have-it", daysAgo(haveItDaysAgo));
    if (openedAsAppBefore) window.localStorage.setItem("pickem-home-screen-installed", daysAgo(3));
  }, [PHONES[phone], planted]);
}

/** Hands the page the browser's own Install offer, the way Chrome on Android does a little while after the page loads. */
async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const offer = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    const state = window as unknown as { installAsked?: number };
    offer.prompt = async () => { state.installAsked = (state.installAsked ?? 0) + 1; };
    offer.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(offer);
  });
}

async function open(page: Page, phone: Phone, options: Planted & { theme?: string; width?: number; path?: string; heading?: boolean } = {}) {
  const { theme = "day", width = 390, path = "/profile", heading = true, ...planted } = options;
  await page.setViewportSize({ width, height: 900 });
  await signIn(page, theme);
  await scriptPhone(page, phone, planted);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: {
    notificationEmail: "tyler@example.com", senderEmail: "pool@example.com", emailNotificationsEnabled: true,
    emailWeeklyEnabled: true, emailFinalLinesEnabled: false, emailSundayFinalLinesEnabled: true, emailEarlyLockEnabled: false,
    emailPickDueSundayEarlyEnabled: true, emailPickDueSundayAfternoonEnabled: true, emailPickDuePrimetimeEnabled: true,
    emailSundayEarlyRevealEnabled: false, emailSundayLateRevealEnabled: false, emailFeaturedWindowRevealEnabled: false,
    emailWeeklyRecapEnabled: true, emailPlayoffDayRecapEnabled: false, emailPlayoffPublicRevealEnabled: false,
    firstName: "Tyler", isCommissioner: false, showPoolChat: false,
  } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto(path);
  if (heading) await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible({ timeout: 30_000 });
  const banner = page.locator('[data-home-screen="banner"]');
  if (phone === "android-prompt" || phone === "chromebook-prompt") await expect.poll(async () => { await offerInstall(page); return banner.getAttribute("data-home-screen-help").catch(() => null); }).toBe(phone);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return { banner, card: page.locator('[data-home-screen="card"]') };
}

const BANNER_STATES: [Phone, boolean][] = [
  ["iphone-safari", false], ["iphone-safari", true], ["iphone-chrome", true], ["iphone-facebook", true],
  ["android-prompt", false], ["android-chrome", true], ["android-samsung", true],
];
const CARD_STATES: Phone[] = ["iphone-safari", "iphone-chrome", "iphone-facebook", "android-prompt", "android-chrome", "android-installed", "installed"];

for (const [label, width] of Object.entries(WIDTHS)) {
  for (const [phone, expanded] of BANNER_STATES) {
    test(`Add to Home Screen banner (${phone}${expanded ? ", steps open" : ""}) at ${label}`, async ({ page }) => {
      const { banner } = await open(page, phone, { width });
      await expect(banner).toHaveAttribute("data-home-screen-help", PHONES[phone].help);
      if (expanded) await banner.getByRole("button", { name: "Show me how" }).click();
      await expect(banner).toHaveScreenshot(`home-screen-banner-${phone}${expanded ? "-steps" : ""}-day-${label}.png`);
    });
  }
  for (const phone of CARD_STATES) {
    test(`Add to Home Screen card on Notifications (${phone}) at ${label}`, async ({ page }) => {
      const { card } = await open(page, phone, { width });
      await expect(card).toHaveAttribute("data-home-screen-help", PHONES[phone].help);
      await expect(card).toHaveScreenshot(`home-screen-card-${phone}-day-${label}.png`);
    });
  }
}

for (const [phone, expanded] of [["chromebook-prompt", false], ["chromebook", true]] as const) {
  test(`Get the app on a Chromebook: banner (${phone}${expanded ? ", steps open" : ""}) and card at desktop-1280`, async ({ page }) => {
    const { banner, card } = await open(page, phone, { width: 1280 });
    await expect(banner).toHaveAttribute("data-home-screen-help", PHONES[phone].help);
    if (expanded) await banner.getByRole("button", { name: "Show me how" }).click();
    await expect(banner).toHaveScreenshot(`home-screen-banner-${phone}${expanded ? "-steps" : ""}-day-desktop-1280.png`);
    await expect(card).toHaveScreenshot(`home-screen-card-${phone}-day-desktop-1280.png`);
  });
}

test("a Chromebook that opened the app before gets no banner, even though Chrome there cannot tell", async ({ page }) => {
  const { banner, card } = await open(page, "chromebook-installed", { width: 1280, openedAsAppBefore: true });
  await expect(card).toHaveAttribute("data-home-screen-help", "installed-tab");
  await expect(banner).toHaveCount(0);
});

test("Add to Home Screen banner sits right under the header", async ({ page }) => {
  await open(page, "iphone-safari");
  await expect(page).toHaveScreenshot("home-screen-banner-in-page-iphone-safari-day-phone-390.png", { clip: { x: 0, y: 0, width: 390, height: 300 } });
});

test("Add to Home Screen banner and card at night", async ({ page }) => {
  const { banner, card } = await open(page, "iphone-safari", { theme: "night" });
  await banner.getByRole("button", { name: "Show me how" }).click();
  await expect(banner).toHaveScreenshot("home-screen-banner-iphone-safari-steps-night-phone-390.png");
  await expect(card).toHaveScreenshot("home-screen-card-iphone-safari-night-phone-390.png");
});

test("every kind of phone, browser and Chromebook is recognised", async ({ page }) => {
  test.setTimeout(120_000);
  for (const phone of Object.keys(PHONES) as Phone[]) {
    if (phone === "desktop") continue;
    const tab = await page.context().newPage();
    const { card } = await open(tab, phone, phone === "chromebook-installed" ? { openedAsAppBefore: true } : {});
    await expect(card, phone).toHaveAttribute("data-home-screen-help", PHONES[phone].help);
    await tab.close();
  }
});

test("Chrome itself finds the app installable (the check behind Android's Install offer) and reads the manifest without errors", async ({ baseURL }) => {
  // The suite's own browser is a cut-down headless one that answers "no problems" about everything, so this asks a full Chromium, with a profile
  // on disk (a private window is never installable), and first proves it does notice a page that is not installable.
  const profile = await mkdtemp(join(tmpdir(), "pickem-install-"));
  const chrome = await chromium.launchPersistentContext(profile, { channel: "chromium", baseURL });
  try {
    const page = chrome.pages()[0] ?? await chrome.newPage();
    const devtools = await chrome.newCDPSession(page);
    await page.goto("/manifest.webmanifest");
    expect((await devtools.send("Page.getInstallabilityErrors")).installabilityErrors.map((error) => error.errorId)).toContain("no-manifest");
    await page.goto("/login");
    await expect(page.locator("form")).toBeVisible({ timeout: 30_000 });
    // The manifest and icons load a moment after the page (and a development server builds them on first request), so the answer is waited for.
    await expect.poll(async () => (await devtools.send("Page.getInstallabilityErrors")).installabilityErrors, { timeout: 30_000 }).toEqual([]);
    const manifest = await devtools.send("Page.getAppManifest");
    expect(manifest.errors).toEqual([]);
    expect(new URL(manifest.url).pathname).toBe("/manifest.webmanifest");
  } finally {
    await chrome.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("a computer sees neither the banner nor the card", async ({ page }) => {
  const { banner, card } = await open(page, "desktop", { width: 1280 });
  await expect(banner).toHaveCount(0);
  await expect(card).toHaveCount(0);
});

test("the installed app sees no banner, and the card says it is on the Home Screen", async ({ page }) => {
  const { banner, card } = await open(page, "installed");
  await expect(banner).toHaveCount(0);
  await expect(card).toContainText("You’re using the Lead Pipe Locks app");
});

test("a Chrome tab on an Android phone that has the app gets no banner, and the card says to open the app", async ({ page }) => {
  const { banner, card } = await open(page, "android-installed");
  await expect(banner).toHaveCount(0);
  await expect(card).toContainText("Open it from your Home Screen or launcher");
});

test("on Android, a browser that cannot ask (Firefox) still knows the app was opened on this phone before; Chrome's own answer wins when the app was removed", async ({ page }) => {
  const firefox = await open(page, "android-firefox", { openedAsAppBefore: true });
  await expect(firefox.card).toHaveAttribute("data-home-screen-help", "installed-tab");
  await expect(firefox.banner).toHaveCount(0);
  const tab = await page.context().newPage();
  const chrome = await open(tab, "android-chrome", { openedAsAppBefore: true });
  await expect(chrome.card).toHaveAttribute("data-home-screen-help", "android-steps");
  await expect(chrome.banner).toBeVisible();
});

test("opening the Home Screen app leaves a note that a browser tab on the same Android phone reads", async ({ page }) => {
  await open(page, "installed");
  expect(await page.evaluate(() => window.localStorage.getItem("pickem-home-screen-installed"))).not.toBeNull();
});

test("if Android never answers whether the app is installed, the banner still shows after a moment", async ({ page }) => {
  const { banner } = await open(page, "android-silent");
  await expect(banner).toHaveAttribute("data-home-screen-help", "android-steps", { timeout: 6_000 });
});

test("the banner is on every page, not only Notifications", async ({ page }) => {
  const { banner } = await open(page, "iphone-safari", { path: "/login", heading: false });
  await expect(banner).toBeVisible({ timeout: 30_000 });
});

test("on an iPhone one tap on Show me how opens the steps and another closes them", async ({ page }) => {
  const { banner } = await open(page, "iphone-safari");
  const toggle = banner.getByRole("button", { name: "Show me how" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(banner.getByRole("listitem")).toHaveCount(0);
  await toggle.click();
  await expect(banner.getByRole("listitem")).toHaveCount(3);
  await expect(banner).toContainText("Add to Home Screen");
  await expect(banner).toContainText("sign in with your PIN");
  await banner.getByRole("button", { name: "Hide" }).click();
  await expect(banner.getByRole("listitem")).toHaveCount(0);
});

test("inside Facebook's window the steps send the player to Safari, and Copy link copies the pool's address", async ({ page }) => {
  const { banner } = await open(page, "iphone-facebook");
  await banner.getByRole("button", { name: "Show me how" }).click();
  await expect(banner).toContainText("Open in Safari");
  await banner.getByRole("button", { name: "Copy the link" }).click();
  await expect(banner.getByText("Copied.")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([`${new URL(page.url()).origin}/`]);
});

test("on Android the banner starts with the steps and turns into one-tap Install when the browser offers it", async ({ page }) => {
  const { banner } = await open(page, "android-chrome");
  await expect(banner.getByRole("button", { name: "Show me how" })).toBeVisible();
  await offerInstall(page);
  await expect(banner).toHaveAttribute("data-home-screen-help", "android-prompt");
  await expect(banner.getByRole("button", { name: "Install" })).toBeVisible();
});

test("on Android the Install button asks the browser to install the app, once, and the banner goes away when it is installed", async ({ page }) => {
  const { banner } = await open(page, "android-prompt");
  await banner.getByRole("button", { name: "Install" }).click();
  expect(await page.evaluate(() => (window as unknown as { installAsked?: number }).installAsked)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(banner).toHaveCount(0);
  await expect(page.locator('[data-home-screen="card"]')).toHaveAttribute("data-home-screen-help", "installed-tab");
});

test("Not now hides the banner, and it stays hidden after the page is reloaded", async ({ page }) => {
  const { banner } = await open(page, "iphone-safari");
  await banner.getByRole("button", { name: "Not now" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  await expect(page.locator('[data-home-screen="card"]')).toBeVisible();   // the card is always there
  await expect(banner).toHaveCount(0);
});

test("I already have it hides the banner, and it stays hidden after the page is reloaded", async ({ page }) => {
  const { banner } = await open(page, "iphone-safari");
  await banner.getByRole("button", { name: "Show me how" }).click();
  await banner.getByRole("button", { name: "I already have it" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  await expect(banner).toHaveCount(0);
});

for (const [planted, shown] of [[{ dismissedDaysAgo: 13 }, false], [{ dismissedDaysAgo: 15 }, true], [{ haveItDaysAgo: 179 }, false], [{ haveItDaysAgo: 181 }, true]] as const) {
  test(`${JSON.stringify(planted)}: the banner is ${shown ? "back" : "still away"}`, async ({ page }) => {
    const { banner } = await open(page, "iphone-safari", planted);
    await expect(banner).toHaveCount(shown ? 1 : 0);
  });
}
