import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-1280": 1280 } as const;
const NOW = "2026-10-04T18:30:00Z";

async function signedOut(page: Page, theme: string) {
  await page.addInitScript((mode) => { window.localStorage.setItem("pickem-theme", mode as string); }, theme);
}

const PROFILE = (all: boolean) => ({
  notificationEmail: "tyler@example.com", senderEmail: "pool@example.com", emailNotificationsEnabled: true,
  emailWeeklyEnabled: true, emailFinalLinesEnabled: all, emailSundayFinalLinesEnabled: true, emailEarlyLockEnabled: all,
  emailPickDueSundayEarlyEnabled: true, emailPickDueSundayAfternoonEnabled: true, emailPickDuePrimetimeEnabled: true,
  emailSundayEarlyRevealEnabled: all, emailSundayLateRevealEnabled: all, emailFeaturedWindowRevealEnabled: all,
  emailWeeklyRecapEnabled: true, emailPlayoffDayRecapEnabled: all, emailPlayoffPublicRevealEnabled: all,
  firstName: "Tyler", isCommissioner: false, showPoolChat: false,
});

const PERIODS = [
  ["w4", "Week 4", 4, "regular", "2026-09-27T17:00:00Z"],
  ["w3", "Week 3", 3, "regular", "2026-09-20T17:00:00Z"],
  ["w2", "Week 2", 2, "regular", "2026-09-13T17:00:00Z"],
  ["w1", "Week 1", 1, "regular", "2026-09-06T17:00:00Z"],
].map(([id, display_name, display_order, period_type, starts_at]) => ({ id, display_name, display_order, period_type, starts_at }));

async function serve(page: Page, { profile, periods }: { profile?: ReturnType<typeof PROFILE>; periods?: typeof PERIODS } = {}) {
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: profile ?? PROFILE(false) }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  // The archive reads two tables straight from the database client.
  await page.route("https://placeholder.invalid/rest/v1/seasons**", (route) => route.fulfill({ json: { id: "season-2026" } }));
  await page.route("https://placeholder.invalid/rest/v1/scoring_periods**", (route) => route.fulfill({ json: periods ?? [] }));
  await page.route("https://placeholder.invalid/auth/**", (route) => route.abort());
  await page.clock.install({ time: new Date(NOW) });
}

type Case = { name: string; path: string; ready: string; auth: boolean; profile?: boolean; periods?: typeof PERIODS; after?: (page: Page) => Promise<void> };
const CASES: Case[] = [
  { name: "login", path: "/login", ready: "h1", auth: false },
  { name: "profile-default", path: "/profile", ready: "form", auth: true, profile: false },
  { name: "profile-custom", path: "/profile", ready: "form", auth: true, profile: true, after: async (page) => { await page.locator("main section button[aria-expanded='false']").first().click(); await page.waitForTimeout(400); } },
  { name: "archive", path: "/archive", ready: "h1", auth: true, periods: PERIODS },
  { name: "archive-empty", path: "/archive", ready: "h1", auth: true, periods: [] },
  { name: "preview", path: "/preview", ready: "h1, h2", auth: true },
];

for (const { name, path, ready, auth, profile, periods, after } of CASES) {
  for (const theme of ["day", "night"]) {
    for (const [label, width] of Object.entries(WIDTHS)) {
      if (theme === "night" && width !== 390 && width !== 1280) continue;
      test(`Account ${name} ${theme} at ${label}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        if (auth) await signIn(page, theme); else await signedOut(page, theme);
        await serve(page, { profile: profile === undefined ? undefined : PROFILE(profile), periods });
        await page.goto(path);
        await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.reload();
        await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(600);
        await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
        await page.waitForFunction(() => [...document.images].every((image) => image.complete));
        await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
        await page.waitForLoadState("networkidle");
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        if (after) await after(page);
        await expect(page).toHaveScreenshot(`account-${name}-${theme}-${label}.png`, { fullPage: true });
      });
    }
  }
}

// Players sign in with a PIN alone; a password manager still needs a username to save it, so the page carries an unseen one.
// It must never be seen or reached: the PIN box is the first thing Tab lands on, and the field takes up no room.
test("the sign-in page offers password managers a username without showing one", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signedOut(page, "day");
  await serve(page, {});
  await page.goto("/login");
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
  const username = page.locator("input[autocomplete='username']");
  await expect(username).toHaveCount(1);
  expect(await username.evaluate((el) => { const box = el.getBoundingClientRect(); return box.width <= 1 && box.height <= 1 && getComputedStyle(el).opacity === "0"; })).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator("#pin")).toBeFocused();
});

// The loading screen before anything has answered (what a phone shows on its way to the PIN page): the site heading, its tabs
// already in their final places (decided before the first paint, so they never slide), and the football.
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Account loading screen before sign-in is known at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day");
    await page.route("**/api/**", () => { /* never answers: the page stays on its loading screen */ });
    await page.route("https://placeholder.invalid/**", (route) => route.abort());
    await page.clock.install({ time: new Date(NOW) });
    await page.goto("/");
    await expect(page.locator(".football-loader").first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expect(page).toHaveScreenshot(`account-loading-before-sign-in-${label}.png`);
  });
}

// The tabs are there and usable at once, already in their final places: they never wait for the account, and a commissioner's
// NCAA Bowls tab (remembered from the last visit) never arrives late and slides the others.
for (const [device, width] of [["phone", 390], ["desktop", 1280]] as const) for (const remembered of [false, true]) {
  test(`the ${device} tabs are usable at once and never move${remembered ? " (commissioner, remembered)" : device === "desktop" ? " (commissioner, first visit)" : " (first visit)"}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page, "day");
    if (remembered) await page.addInitScript(() => window.localStorage.setItem("pickem-nav-tabs", JSON.stringify({ bowls: true, commissioner: true })));
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => { answer = resolve; });
    await page.route("**/api/**", async (route) => {
      if (!route.request().url().includes("/api/profile")) return;
      await answered;
      // On a desktop even a commissioner's first visit never moves the tabs (they are set from the left); on a phone the centered
      // tabs can shift once for a commissioner's first visit on a new device, so the phone case covers a player.
      await route.fulfill({ json: { ...PROFILE(false), isCommissioner: remembered || device === "desktop" } });
    });
    await page.route("https://placeholder.invalid/**", (route) => route.abort());
    await page.clock.install({ time: new Date(NOW) });
    await page.goto("/");
    const nav = page.locator(device === "phone" ? ".mobile-primary-nav" : "nav.site-nav");
    const slate = nav.getByRole("link", { name: "The Slate" });
    await expect(slate).toBeVisible({ timeout: 30_000 });
    await expect(nav.getByRole("link", { name: "NCAA Bowls" })).toBeVisible({ visible: remembered });
    const before = await slate.boundingBox();
    answer();
    await page.waitForTimeout(800);
    expect((await slate.boundingBox())?.x).toBe(before?.x);
    // Usable before anything has loaded: the tab takes you straight there.
    await slate.click();
    await expect(page).toHaveURL(/\/board$/);
  });
}
