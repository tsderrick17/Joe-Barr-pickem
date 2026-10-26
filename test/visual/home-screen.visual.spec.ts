import { expect, test, type Page } from "@playwright/test";

// "Add to Home Screen": the slim banner under the header of every page and the card on the Notifications page. The browser is made to look like each kind of
// phone (an iPhone in Safari, an iPhone in Chrome, Android with and without the browser's one-tap Install, the installed app, a computer), so every
// state can be shown as it reads, and the taps (Show me how, Install, Copy link, Not now) can be followed. Nothing is ever really installed.
const WIDTHS = { "phone-360": 360, "phone-390": 390 } as const;
const AGENTS = {
  "iphone-safari": { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", platform: "iPhone" },
  "iphone-chrome": { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1", platform: "iPhone" },
  android: { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", platform: "Linux armv81" },
  desktop: null,
} as const;

type Phone = "iphone-safari" | "iphone-chrome" | "android-prompt" | "android-steps" | "installed" | "desktop";
const HELP: Record<Phone, string> = { "iphone-safari": "iphone-safari", "iphone-chrome": "iphone-other-browser", "android-prompt": "android-prompt", "android-steps": "android-steps", installed: "installed", desktop: "none" };

async function signIn(page: Page, theme: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await page.addInitScript(([value, mode]) => {
    window.localStorage.setItem("sb-placeholder-auth-token", value as string);
    window.localStorage.setItem("pickem-theme", mode as string);
  }, [JSON.stringify(session), theme]);
}

/** Makes the browser look like one kind of phone, before the page runs. `dismissedDaysAgo` plants an earlier "Not now". */
async function scriptPhone(page: Page, phone: Phone, dismissedDaysAgo?: number) {
  const agent = AGENTS[phone === "iphone-safari" ? "iphone-safari" : phone === "iphone-chrome" ? "iphone-chrome" : phone === "desktop" ? "desktop" : "android"];
  await page.addInitScript(([chosen, installed, dismissed]) => {
    const scripted = chosen as { userAgent: string; platform: string } | null;
    if (scripted) {
      Object.defineProperty(navigator, "userAgent", { get: () => scripted.userAgent, configurable: true });
      Object.defineProperty(navigator, "platform", { get: () => scripted.platform, configurable: true });
    }
    if (installed) Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    const copied: string[] = [];
    (window as unknown as { copied: string[] }).copied = copied;
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => { copied.push(text); } }, configurable: true });
    if (typeof dismissed === "number") window.localStorage.setItem("pickem-home-screen-dismissed", String(Date.now() - dismissed * 86_400_000));
  }, [agent, phone === "installed", dismissedDaysAgo ?? null]);
}

/** Hands the page the browser's own Install offer, the way Chrome on Android does a moment after the page loads. */
async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const offer = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    const state = window as unknown as { installAsked?: number };
    offer.prompt = async () => { state.installAsked = (state.installAsked ?? 0) + 1; };
    offer.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(offer);
  });
}

async function open(page: Page, phone: Phone, options: { theme?: string; width?: number; path?: string; dismissedDaysAgo?: number; heading?: boolean } = {}) {
  const { theme = "day", width = 390, path = "/profile", dismissedDaysAgo, heading = true } = options;
  await page.setViewportSize({ width, height: 900 });
  await signIn(page, theme);
  await scriptPhone(page, phone, dismissedDaysAgo);
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
  if (heading) await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible({ timeout: 30_000 });
  if (phone === "android-prompt") await expect.poll(async () => { await offerInstall(page); return page.locator('[data-home-screen="banner"]').count(); }).toBe(1);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return { banner: page.locator('[data-home-screen="banner"]'), card: page.locator('[data-home-screen="card"]') };
}

const BANNER_STATES: [Phone, boolean][] = [["iphone-safari", false], ["iphone-safari", true], ["iphone-chrome", false], ["iphone-chrome", true], ["android-prompt", false]];
const CARD_STATES: Phone[] = ["iphone-safari", "iphone-chrome", "android-prompt", "android-steps", "installed"];

for (const [label, width] of Object.entries(WIDTHS)) {
  for (const [phone, expanded] of BANNER_STATES) {
    test(`Add to Home Screen banner (${phone}${expanded ? ", steps open" : ""}) at ${label}`, async ({ page }) => {
      const { banner } = await open(page, phone, { width });
      await expect(banner).toHaveAttribute("data-home-screen-help", HELP[phone]);
      if (expanded) await banner.getByRole("button", { name: "Show me how" }).click();
      await expect(banner).toHaveScreenshot(`home-screen-banner-${phone}${expanded ? "-steps" : ""}-day-${label}.png`);
    });
  }
  for (const phone of CARD_STATES) {
    test(`Add to Home Screen card on Notifications (${phone}) at ${label}`, async ({ page }) => {
      const { card } = await open(page, phone, { width });
      await expect(card).toHaveAttribute("data-home-screen-help", HELP[phone]);
      await expect(card).toHaveScreenshot(`home-screen-card-${phone}-day-${label}.png`);
    });
  }
}

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

test("a computer sees neither the banner nor the card", async ({ page }) => {
  const { banner, card } = await open(page, "desktop", { width: 1280 });
  await expect(banner).toHaveCount(0);
  await expect(card).toHaveCount(0);
});

test("the installed app sees no banner, and the card says it is on the Home Screen", async ({ page }) => {
  const { banner, card } = await open(page, "installed");
  await expect(banner).toHaveCount(0);
  await expect(card).toContainText("Lead Pipe Locks is on your Home Screen");
});

test("Android without the browser's one-tap Install gets no banner, only the steps on the Notifications page", async ({ page }) => {
  const { banner, card } = await open(page, "android-steps");
  await expect(banner).toHaveCount(0);
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card).toContainText("Install app");
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
  await banner.getByRole("button", { name: "Hide" }).click();
  await expect(banner.getByRole("listitem")).toHaveCount(0);
});

test("on an iPhone in Chrome the banner sends the player to Safari, and Copy link copies the pool's address", async ({ page }) => {
  const { banner } = await open(page, "iphone-chrome");
  await expect(banner).toContainText("from Safari");
  await banner.getByRole("button", { name: "Show me how" }).click();
  await banner.getByRole("button", { name: "Copy link" }).click();
  await expect(banner.getByText("Copied.")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([`${new URL(page.url()).origin}/`]);
});

test("on Android the Install button asks the browser to install the app, once, and the banner goes away", async ({ page }) => {
  const { banner } = await open(page, "android-prompt");
  await banner.getByRole("button", { name: "Install" }).click();
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { installAsked?: number }).installAsked)).toBe(1);
});

test("Not now hides the banner, and it stays hidden after the page is reloaded", async ({ page }) => {
  const { banner } = await open(page, "iphone-safari");
  await banner.getByRole("button", { name: "Not now" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.locator('[data-home-screen="card"]')).toBeVisible();   // the card is always there
  await expect(banner).toHaveCount(0);
});

for (const [days, shown] of [[13, false], [15, true]] as const) {
  test(`${days} days after Not now the banner is ${shown ? "back" : "still away"}`, async ({ page }) => {
    const { banner } = await open(page, "iphone-safari", { dismissedDaysAgo: days });
    await expect(banner).toHaveCount(shown ? 1 : 0);
  });
}
