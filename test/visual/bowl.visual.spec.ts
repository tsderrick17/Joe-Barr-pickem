import { expect, test, type Page } from "@playwright/test";
import { bowlResponse } from "./standings-fixtures.mjs";

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-1280": 1280 } as const;
// Mid-December: the bowl season is about to start. Scenarios that need games
// under way set their own clock.
const NOW = "2026-12-12T15:00:00Z";
const ALL_PICKS = { "bowl-0": "h0", "bowl-1": "a1", "bowl-2": "h2", "bowl-3": "h3", "bowl-4": "a4", "bowl-5": "h5" };
type Scenario = { build: () => ReturnType<typeof bowlResponse>; now?: string; click?: string; fullGuess?: boolean };
const SCENARIOS: Record<string, Scenario> = {
  "not-joined": { build: () => bowlResponse({ optedIn: false, entryOpen: true }) },
  "picked": { build: () => bowlResponse({ optedIn: true, entryOpen: true, picks: { "bowl-1": "a1", "bowl-2": "h2", "bowl-3": "h3" } }) },
  // Two games have kicked off: their buttons are locked, the rest are open.
  "games-started": { build: () => bowlResponse({ optedIn: true, entryOpen: true, picks: ALL_PICKS }), now: "2026-12-20T20:00:00Z" },
  // Every game picked and the tiebreaker saved: the receipt reads complete.
  "complete-saved": { build: () => bowlResponse({ optedIn: true, entryOpen: true, picks: ALL_PICKS, guess: 49 }) },
  // A team is chosen but not yet submitted: the receipt shows unsaved changes.
  "unsaved-change": { build: () => bowlResponse({ optedIn: true, entryOpen: true, picks: { "bowl-1": "a1" } }), click: "bowl-0" },
  // Not a participant and the first kickoff has passed: entry is closed.
  "entry-closed": { build: () => bowlResponse({ optedIn: false, entryOpen: false }), now: "2026-12-20T20:00:00Z" },
};

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

for (const [scenario, { build, now, click }] of Object.entries(SCENARIOS)) {
  for (const theme of ["day", "night"]) {
    for (const [label, width] of Object.entries(WIDTHS)) {
      if (theme === "night" && width !== 390 && width !== 1280) continue;
      test(`Bowl picks ${scenario} ${theme} at ${label}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await signIn(page, theme);
        await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
        await page.route("**/api/bowl-pool**", (route) => route.fulfill({ json: build() }));
        await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
        await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
        await page.route("https://placeholder.invalid/**", (route) => route.abort());
        await page.clock.install({ time: new Date(now ?? NOW) });
        await page.goto("/bowl-pool");
        await expect(page.locator(".bowl-pool-page h2, .bowl-claim h3, :text('Bowl Pool entry is closed')").first()).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.reload();
        await expect(page.locator(".bowl-pool-page h2, .bowl-claim h3, :text('Bowl Pool entry is closed')").first()).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        // Lazy images below the fold load only when scrolled near; make them all load now.
        await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
        await page.waitForFunction(() => [...document.images].every((image) => image.complete));
        await page.waitForLoadState("networkidle");
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        if (click) {
          // Choose the first game's favorite, then let the pennant finish rising.
          await page.locator("#bowl-selections button[aria-label^='Select favorite team']").first().click();
          await page.waitForTimeout(900);
        }
        await expect(page).toHaveScreenshot(`bowl-${scenario}-${theme}-${label}.png`, { fullPage: true });
      });
    }
  }
}

// The receipt must stay in view while the schedule scrolls, at phone and desktop widths.
for (const width of [390, 1280]) {
  test(`Bowl receipt stays pinned while scrolling at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await signIn(page, "day");
    await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
    await page.route("**/api/bowl-pool**", (route) => route.fulfill({ json: bowlResponse({ optedIn: true, entryOpen: true, picks: { "bowl-1": "a1" } }) }));
    await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
    await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
    await page.route("https://placeholder.invalid/**", (route) => route.abort());
    await page.clock.install({ time: new Date(NOW) });
    await page.goto("/bowl-pool");
    const receipt = page.locator(".bowl-receipt-frame");
    await expect(receipt).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const box = await receipt.boundingBox();
    expect(box).not.toBeNull();
    // Visible, just under the site menu, rather than scrolled off the top.
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(200);
  });
}
