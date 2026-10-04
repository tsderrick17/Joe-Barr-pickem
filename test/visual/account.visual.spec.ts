import { expect, test, type Page } from "@playwright/test";

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-1280": 1280 } as const;
const NOW = "2026-10-04T18:30:00Z";

/** A stored, far-future session so the page treats the browser as signed in. Never sent anywhere real. */
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
        await page.waitForLoadState("networkidle");
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        if (after) await after(page);
        await expect(page).toHaveScreenshot(`account-${name}-${theme}-${label}.png`, { fullPage: true });
      });
    }
  }
}
