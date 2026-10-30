import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";

// The one-tap "Turn on notifications" banner inside the Home Screen app. The browser's notification features are replaced with a scripted phone
// (as in phone-notifications.visual.spec.ts) and the page is told it is running as the Home Screen app. No real notification is ever asked for or sent.
type Phone = { permission?: "default" | "granted" | "denied"; subscribed?: boolean; standalone?: boolean; answer?: "granted" | "denied" | "default" };

async function scriptPhone(page: Page, phone: Phone) {
  await page.addInitScript((script) => {
    const { permission = "default", subscribed = false, standalone = true, answer = "granted" } = script as Phone;
    const state = { permission, subscription: null as null | object, asked: 0 };
    const subscription = () => ({ endpoint: "https://web.push.apple.com/SCRIPTED", toJSON() { return { endpoint: "https://web.push.apple.com/SCRIPTED", keys: { p256dh: "B".padEnd(87, "x"), auth: "a".padEnd(22, "y") } }; }, async unsubscribe() { state.subscription = null; return true; } });
    if (subscribed) state.subscription = subscription();
    (window as unknown as { phone: typeof state }).phone = state;
    if (standalone) Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    Object.defineProperty(window, "PushManager", { value: function PushManager() {}, configurable: true });
    Object.defineProperty(window, "Notification", { value: { get permission() { return state.permission; }, async requestPermission() { state.asked += 1; if (state.permission === "default") state.permission = answer; return state.permission; } }, configurable: true });
    const registration = { pushManager: { async getSubscription() { return state.subscription; }, async subscribe() { state.subscription = subscription(); return state.subscription; } } };
    Object.defineProperty(navigator, "serviceWorker", { value: { async getRegistration() { return registration; }, async register() { return registration; }, ready: Promise.resolve(registration) }, configurable: true });
  }, phone);
}

async function open(page: Page, phone: Phone = {}, { path = "/board", theme = "day", width = 390, signedIn = true } = {}) {
  const requests: string[] = [];
  await page.setViewportSize({ width, height: 800 });
  if (signedIn) await signIn(page, theme);
  await scriptPhone(page, phone);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { notificationEmail: "", senderEmail: "", emailNotificationsEnabled: true, firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("**/api/push/**", async (route) => {
    const request = route.request();
    requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    if (request.url().endsWith("/api/push/key")) return route.fulfill({ json: { publicKey: "AQID_-8" } });
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto(path);
  // The banner decides after the page has loaded; give it the moment it needs before asserting it is absent.
  await page.waitForLoadState("networkidle");
  return { banner: page.locator("[data-notifications-banner]"), requests };
}

async function shoot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.locator("[data-notifications-banner]")).toHaveScreenshot(name);
}

for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Turn on notifications banner at ${label}`, async ({ page }) => {
    const { banner } = await open(page, {}, { width });
    await expect(banner).toHaveAttribute("data-notifications-banner", "offer");
    await shoot(page, `notifications-banner-offer-day-${label}.png`);
  });
}

test("Turn on notifications banner at night", async ({ page }) => {
  const { banner } = await open(page, {}, { theme: "night" });
  await expect(banner).toHaveAttribute("data-notifications-banner", "offer");
  await shoot(page, "notifications-banner-offer-night-phone-390.png");
});

test("one tap asks the phone, saves it, and says it worked", async ({ page }) => {
  const { banner, requests } = await open(page);
  await banner.getByRole("button", { name: "Turn on" }).click();
  await expect(banner).toHaveAttribute("data-notifications-banner", "on");
  expect(await page.evaluate(() => (window as unknown as { phone: { asked: number } }).phone.asked)).toBe(1);
  expect(requests).toEqual(["GET /api/push/key", "PUT /api/push/subscription"]);
  await shoot(page, "notifications-banner-on-day-phone-390.png");
});

// A phone that said no remembers it, and the banner is never offered to a blocked phone (see "no banner when the phone has blocked them").
test("if the phone says no, the banner says where to turn them on later and saves nothing", async ({ page }) => {
  const { banner, requests } = await open(page, { answer: "denied" });
  await banner.getByRole("button", { name: "Turn on" }).click();
  await expect(banner).toHaveAttribute("data-notifications-banner", "later");
  expect(requests).toEqual([]);
});

test("Not now hides the banner and it stays away when the app is opened again", async ({ page }) => {
  const { banner } = await open(page);
  await banner.getByRole("button", { name: "Not now" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-notifications-banner]")).toHaveCount(0);
});

const NEVER: [string, Phone, { path?: string; signedIn?: boolean }][] = [
  ["in a browser tab (not the Home Screen app)", { standalone: false }, {}],
  ["when notifications are already on", { permission: "granted", subscribed: true }, {}],
  ["when the phone has blocked them", { permission: "denied" }, {}],
  ["on the Notifications page, which has its own button", {}, { path: "/profile" }],
  ["before signing in", {}, { path: "/login", signedIn: false }],
];
for (const [when, phone, options] of NEVER) {
  test(`no banner ${when}`, async ({ page }) => {
    const { banner } = await open(page, phone, options);
    await expect(banner).toHaveCount(0);
  });
}
