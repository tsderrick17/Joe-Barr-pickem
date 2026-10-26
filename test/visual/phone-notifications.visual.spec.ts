import { expect, test, type Page } from "@playwright/test";

// "Notifications on this phone" on the Notifications page (for now the Commissioner's alone). The browser's notification features are replaced with a
// scripted phone, so the page can be shown as it reads on a phone that has them off, on, blocked, or cannot have them at all, and the taps (turn on, send a
// test, turn off) can be followed to the requests they make. No real notification is ever asked for or sent.
const WIDTHS = { "phone-390": 390, "desktop-1280": 1280 } as const;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

type Phone = "off" | "on" | "blocked" | "iphone-tab" | "no-support";

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

/** Replaces the browser's notification features with a scripted phone, before the page runs. */
async function scriptPhone(page: Page, phone: Phone) {
  await page.addInitScript(([kind, iphone]) => {
    const state = { permission: kind === "blocked" ? "denied" : kind === "on" ? "granted" : "default", subscription: null as null | object, asked: 0, unsubscribed: 0, registered: 0 };
    const subscription = () => ({ endpoint: "https://web.push.apple.com/SCRIPTED", toJSON() { return { endpoint: "https://web.push.apple.com/SCRIPTED", keys: { p256dh: "B".padEnd(87, "x"), auth: "a".padEnd(22, "y") } }; }, async unsubscribe() { state.subscription = null; state.unsubscribed += 1; return true; } });
    if (kind === "on") state.subscription = subscription();
    (window as unknown as { phone: typeof state }).phone = state;
    if (kind === "iphone-tab" || kind === "no-support") {
      delete (window as unknown as { PushManager?: unknown }).PushManager;
      if (kind === "iphone-tab") Object.defineProperty(navigator, "userAgent", { get: () => iphone, configurable: true });
      return;
    }
    Object.defineProperty(window, "PushManager", { value: function PushManager() {}, configurable: true });
    Object.defineProperty(window, "Notification", { value: { get permission() { return state.permission; }, async requestPermission() { state.asked += 1; if (state.permission === "default") state.permission = "granted"; return state.permission; } }, configurable: true });
    const registration = { pushManager: { async getSubscription() { return state.subscription; }, async subscribe() { state.subscription = subscription(); return state.subscription; } } };
    Object.defineProperty(navigator, "serviceWorker", { value: { async getRegistration() { return state.subscription || state.registered ? registration : undefined; }, async register() { state.registered += 1; return registration; }, ready: Promise.resolve(registration) }, configurable: true });
  }, [phone, IPHONE]);
}

async function open(page: Page, phone: Phone, theme = "day", width = 390) {
  const requests: { method: string; path: string; body: unknown }[] = [];
  await page.setViewportSize({ width, height: 900 });
  await signIn(page, theme);
  await scriptPhone(page, phone);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: {
    notificationEmail: "tyler@example.com", senderEmail: "pool@example.com", emailNotificationsEnabled: true,
    emailWeeklyEnabled: true, emailFinalLinesEnabled: false, emailSundayFinalLinesEnabled: true, emailEarlyLockEnabled: false,
    emailPickDueSundayEarlyEnabled: true, emailPickDueSundayAfternoonEnabled: true, emailPickDuePrimetimeEnabled: true,
    emailSundayEarlyRevealEnabled: false, emailSundayLateRevealEnabled: false, emailFeaturedWindowRevealEnabled: false,
    emailWeeklyRecapEnabled: true, emailPlayoffDayRecapEnabled: false, emailPlayoffPublicRevealEnabled: false,
    firstName: "Tyler", isCommissioner: true, showPoolChat: false,
  } }));
  await page.route("**/api/push/**", async (route) => {
    const request = route.request();
    requests.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postData() ? JSON.parse(request.postData()!) : null });
    if (request.url().endsWith("/api/push/key")) return route.fulfill({ json: { publicKey: "AQID_-8" } });
    if (request.url().endsWith("/api/push/test")) return route.fulfill({ json: { devices: 1, sent: 1, failed: 0, removed: 0 } });
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/profile");
  const section = page.locator("[data-phone-notifications]");
  await expect(section).toBeVisible({ timeout: 30_000 });
  await expect(section).not.toHaveAttribute("data-phone-notifications", "checking");
  return { section, requests };
}

const EXPECTED: Record<Phone, string> = { off: "off", on: "on", blocked: "blocked", "iphone-tab": "not-installed", "no-support": "unsupported" };

for (const phone of Object.keys(EXPECTED) as Phone[]) {
  for (const [label, width] of Object.entries(WIDTHS)) {
    test(`Notifications on this phone (${phone}) at ${label}`, async ({ page }) => {
      const { section } = await open(page, phone, "day", width);
      await expect(section).toHaveAttribute("data-phone-notifications", EXPECTED[phone]);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(section).toHaveScreenshot(`phone-notifications-${phone}-day-${label}.png`);
    });
  }
}

test("Notifications on this phone at night", async ({ page }) => {
  const { section } = await open(page, "on", "night", 390);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(section).toHaveScreenshot("phone-notifications-on-night-phone-390.png");
});

test("only the Commissioner sees the phone notifications section for now", async ({ page }) => {
  await signIn(page, "day");
  await scriptPhone(page, "off");
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { notificationEmail: "", senderEmail: "", emailNotificationsEnabled: false, firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-phone-notifications]")).toHaveCount(0);
});

test("turning notifications on asks the phone, subscribes with the pool's key and saves the phone; the test and turning off follow", async ({ page }) => {
  const { section, requests } = await open(page, "off");
  await section.getByRole("button", { name: "Turn on notifications" }).click();
  await expect(section).toHaveAttribute("data-phone-notifications", "on");
  expect(await page.evaluate(() => (window as unknown as { phone: { asked: number; registered: number } }).phone)).toMatchObject({ asked: 1, registered: 1 });
  expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual(["GET /api/push/key", "PUT /api/push/subscription"]);
  expect(requests[1].body).toEqual({ endpoint: "https://web.push.apple.com/SCRIPTED", keys: { p256dh: "B".padEnd(87, "x"), auth: "a".padEnd(22, "y") } });

  await section.getByRole("button", { name: "Send me a test" }).click();
  await expect(section.getByText("Sent. It should arrive in a few seconds.").first()).toBeVisible();
  expect(requests.at(-1)).toMatchObject({ method: "POST", path: "/api/push/test" });

  await section.getByRole("button", { name: "Turn off on this phone" }).click();
  await expect(section).toHaveAttribute("data-phone-notifications", "off");
  expect(await page.evaluate(() => (window as unknown as { phone: { unsubscribed: number } }).phone.unsubscribed)).toBe(1);
  expect(requests.at(-1)).toEqual({ method: "DELETE", path: "/api/push/subscription", body: { endpoint: "https://web.push.apple.com/SCRIPTED" } });
});

test("a phone that is already subscribed shows as on and quietly refreshes its saved copy", async ({ page }) => {
  const { section, requests } = await open(page, "on");
  await expect(section).toHaveAttribute("data-phone-notifications", "on");
  await expect.poll(() => requests.map((request) => `${request.method} ${request.path}`)).toContain("PUT /api/push/subscription");
});

test("saying no to the phone's question leaves notifications off, and a blocked phone offers no button to turn them on", async ({ page }) => {
  const { section } = await open(page, "off");
  await page.evaluate(() => { const phone = (window as unknown as { phone: { permission: string } }).phone; Object.defineProperty(window.Notification, "requestPermission", { value: async () => { phone.permission = "denied"; return "denied"; }, configurable: true }); });
  await section.getByRole("button", { name: "Turn on notifications" }).click();
  await expect(section).toHaveAttribute("data-phone-notifications", "blocked");
  await expect(section.getByRole("button")).toHaveCount(0);
});
