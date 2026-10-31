import { expect, test } from "@playwright/test";
import { signIn } from "./session";
import { bowlResponse } from "./standings-fixtures.mjs";

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-1280": 1280 } as const;
// Mid-December: the bowl season is about to start. Scenarios that need games
// under way set their own clock.
const NOW = "2026-12-12T15:00:00Z";
const ALL_PICKS = { "bowl-0": "h0", "bowl-1": "a1", "bowl-2": "h2", "bowl-3": "h3", "bowl-4": "a4", "bowl-5": "h5" };
type Scenario = { build: () => ReturnType<typeof bowlResponse>; now?: string; click?: string; fullGuess?: boolean };
const SCENARIOS: Record<string, Scenario> = {
  "not-joined": { build: () => bowlResponse({ optedIn: false, entryOpen: true }) },
  // Georgia Southern and Ohio State are the two-line names: their lettering must stay inside the megaphone's cone, clear of its band.
  "picked": { build: () => bowlResponse({ optedIn: true, entryOpen: true, picks: { "bowl-1": "a1", "bowl-2": "a2", "bowl-3": "a3" } }) },
  // Two games have kicked off: their buttons are locked, the rest are open.
  "games-started": { build: () => bowlResponse({ optedIn: true, entryOpen: true, picks: ALL_PICKS }), now: "2026-12-20T20:00:00Z" },
  // Every game picked and the tiebreaker saved: the receipt reads complete.
  "complete-saved": { build: () => bowlResponse({ optedIn: true, entryOpen: true, picks: ALL_PICKS, guess: 49 }) },
  // A team is chosen but not yet submitted: the receipt shows unsaved changes.
  "unsaved-change": { build: () => bowlResponse({ optedIn: true, entryOpen: true, picks: { "bowl-1": "a1" } }), click: "bowl-0" },
  // Games that did not go as scheduled, with the player's picks kept on them: the Cure Bowl postponed and the Gasparilla Bowl cancelled (the word
  // stands where the venue goes and the buttons are locked), and the Rose Bowl with no announced time and a line that is still preliminary (black,
  // not the teal of an official line).
  "disrupted": { build: () => bowlResponse({ optedIn: true, entryOpen: true, picks: { "bowl-1": "a1", "bowl-2": "h2", "bowl-4": "a4" }, gameOverrides: { 1: { status: "postponed" }, 2: { status: "cancelled" }, 3: { time_confirmed: false, line: { favorite_team_id: "h3", locked_spread: "-3", locked_at: null } } } }) },
  // Not a participant and the first kickoff has passed: entry is closed.
  "entry-closed": { build: () => bowlResponse({ optedIn: false, entryOpen: false }), now: "2026-12-20T20:00:00Z" },
};

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
        await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
        await page.waitForLoadState("networkidle");
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        if (click) {
          // Choose the first game's favorite, then let the megaphone finish its swing.
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

// While the Bowl Pool is still arriving, the page is the spinning football on its own, like Standings and the Slate.
test("Bowl Pool loading screen at phone-390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day");
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.route("**/api/bowl-pool**", () => { /* never answers: the page stays on its loading screen */ });
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(NOW) });
  await page.goto("/bowl-pool");
  await expect(page.locator(".football-loader").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page).toHaveScreenshot("bowl-loading-phone-390.png");
});
