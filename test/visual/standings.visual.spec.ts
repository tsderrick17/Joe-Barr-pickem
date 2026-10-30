import { chromium, expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
import { BOWL_BY_SCENARIO, bowlResponse, homeResponse, SCENARIOS, seasonSnapshotResponse } from "./standings-fixtures.mjs";

// The Season Snapshot chart draws and re-measures after a toggle. Wait for every running animation and two
// painted frames so a recorded baseline and a later check agree about the settled chart.
async function settled(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-1280": 1280 } as const;
// Night mode is checked on the states that exercise the most styles.
const NIGHT = new Set(["regular-in", "playoff-wildcard", "commissioner", "bowl-results", "bowl-claim-open", "off-season"]);

async function serve(page: Page, scenario: string) {
  const home = homeResponse(scenario);
  // Registered first so the specific routes below win: nothing under /api reaches a server.
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: home }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: home.isCommissioner, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/bowl-pool**", (route) => route.fulfill({ json: bowlResponse((BOWL_BY_SCENARIO as Record<string, Parameters<typeof bowlResponse>[0]>)[scenario]) }));
  await page.route("**/api/season-snapshot**", (route) => route.fulfill({ json: seasonSnapshotResponse(scenario) }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(home.serverTime) });
}

async function settle(page: Page) {
  await page.goto("/");
  await expect(page.locator(".my-ticket, .season-closed-banner").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.reload();
  await expect(page.locator(".my-ticket, .season-closed-banner").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 30)); }
    window.scrollTo(0, 0);
  });
  // Lazy images below the fold load only when scrolled near; make them all load now.
  await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
  await page.waitForLoadState("networkidle");
  // The Bowl Card's score tiles spin when the card first comes into view. Bring it
  // into view on purpose (a quick scroll can pass it before it has rendered), wait
  // for the tiles to land, then return to the top for the capture.
  if (await page.locator(".bowl-standings-scroll").count()) {
    await page.locator(".bowl-standings-scroll").first().scrollIntoViewIfNeeded();
    // Long enough for the card to finish settling: a baseline recorded with -u takes the first frame it sees, and
    // the card was still changing on Linux at 200 ms, so recording and checking disagreed about its final look.
    await page.waitForTimeout(1500);
  }
  await page.waitForFunction(() => [...document.querySelectorAll(".bowl-score-tile")].every((tile) => tile.getAttribute("data-settled") === "true"), undefined, { timeout: 10_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

// The Survivor logos are drawn from large originals scaled to about 28 px. On Linux CI, the browser very
// occasionally settles on a slightly different downscale of them (about 550 pixels in one band, the same run to
// run on the same code), so their pictures are masked: each logo's position and size are still checked, only the
// artwork inside the box is not.
for (const scenario of Object.keys(SCENARIOS)) {
  for (const theme of ["day", "night"]) {
    if (theme === "night" && !NIGHT.has(scenario)) continue;
    for (const [label, width] of Object.entries(WIDTHS)) {
      test(`Standings ${scenario} ${theme} at ${label}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await signIn(page, theme);
        await serve(page, scenario);
        await settle(page);
        await expect(page).toHaveScreenshot(`standings-${scenario}-${theme}-${label}.png`, { fullPage: true, mask: [page.locator(".survivor-standings-scroll img")] });
        if (scenario === "commissioner" || scenario === "commissioner-playoff") {
          // The back of the pad: the Season Snapshot.
          await page.getByRole("button", { name: "Show the Season Snapshot" }).click();
          await page.waitForTimeout(1200);
          await settled(page);
          await expect(page).toHaveScreenshot(`standings-${scenario}-${theme}-flipped-${label}.png`, { fullPage: true, mask: [page.locator(".survivor-standings-scroll img")] });
          if (scenario === "commissioner-playoff") {
            // The other half: the regular season, with its 6 Wk / All range.
            await page.getByRole("button", { name: "Season", exact: true }).click();
            await page.waitForTimeout(1500);
            await settled(page);
            await expect(page).toHaveScreenshot(`standings-${scenario}-${theme}-flipped-regular-${label}.png`, { fullPage: true, mask: [page.locator(".survivor-standings-scroll img")] });
          }
        }
      });
    }
  }
}

// The 6 Wk window needs more than six weeks to scroll, so this state serves a nine-week season. The position rail sits
// beneath the week numbers in the pad's own colors; the screenshot guards both. Headless Chromium hides scroll bars
// everywhere else, so this is the one place the browser is launched with them drawn: a scroll bar returning would show.
for (const theme of ["day", "night"]) {
  for (const label of ["phone-390", "desktop-1280"] as const) {
    test(`Season Snapshot 6 Wk ${theme} at ${label}`, async ({ baseURL }) => {
      const browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
      try {
        const page = await (await browser.newContext({ baseURL })).newPage();
        await page.setViewportSize({ width: WIDTHS[label], height: 900 });
        await signIn(page, theme);
        await serve(page, "commissioner-playoff");
        await page.route("**/api/season-snapshot**", (route) => route.fulfill({ json: seasonSnapshotResponse("commissioner-playoff", 9) }));
        await settle(page);
        await page.getByRole("button", { name: "Show the Season Snapshot" }).click();
        await page.getByRole("button", { name: "Season", exact: true }).click();
        await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
        await page.waitForTimeout(1500);
        await settled(page);
        // Nothing of the plot sits beneath a scroll bar: the browser's own is hidden and the page's rail takes its place.
        const plot = page.locator(".season-snapshot-plot-scroll");
        expect(await plot.evaluate((element) => (element as HTMLElement).offsetHeight - element.clientHeight), "no scroll bar eats into the plot").toBe(0);
        expect(await plot.evaluate((element) => element.scrollHeight - element.clientHeight), "the week numbers are all inside the plot").toBeLessThanOrEqual(0);
        await expect(page.locator(".season-snapshot-chart")).toHaveScreenshot(`standings-commissioner-playoff-${theme}-flipped-sixweek-${label}.png`);
      } finally {
        await browser.close();
      }
    });
  }
}

test("once Survivor has a champion, even the champion's ticket owes only the two Pick'em selections", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page, "day");
  await serve(page, "regular-complete-champion");
  await page.goto("/");
  const ticket = page.locator(".my-ticket");
  await expect(ticket).toBeVisible({ timeout: 30000 });
  await expect(ticket.locator(".my-ticket-completion")).toContainText("/2 SELECTIONS MADE");
  await expect(ticket.getByText("SURVIVOR WINNER")).toHaveCount(0);
});

test("the account menu opens from your name, and Sign out asks before signing out", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page, "day");
  await serve(page, "regular-in");
  await page.goto("/");
  await page.locator(".pickem-scoreboard-ledger").waitFor({ timeout: 30000 });
  await page.locator(".account-menu-button:visible").click();
  await expect(page.getByRole("menuitem", { name: "Notifications" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByText("Sign out?", { exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Cancel" }).click();
  await expect(page.getByText("Sign out?", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

// The flip button is in the same physical spot on both faces of the Pick'em Pad, so it can be tapped back and forth without moving a
// thumb, and the other toggles on the back sit out to its left.
for (const scenario of ["commissioner", "commissioner-playoff"]) {
  for (const width of [360, 390, 700, 900, 1280]) {
    test(`Standings ${scenario} flip button stays put at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "day");
      await serve(page, scenario);
      await settle(page);
      const spots = () => page.evaluate(() => {
        const showing = (element: Element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== "hidden";
        const button = document.querySelector(".pad-flip-button")!.getBoundingClientRect();
        const toggles = [...document.querySelectorAll(".season-snapshot-range")].filter(showing).map((element) => element.getBoundingClientRect().right);
        return { x: button.left, y: button.top + window.scrollY, toggles };
      });
      const front = await spots();
      await page.getByRole("button", { name: "Show the Season Snapshot" }).click();
      await page.waitForTimeout(1500);
      const back = await spots();
      expect(Math.abs(back.x - front.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.y - front.y)).toBeLessThanOrEqual(1);
      expect(back.toggles.length).toBeGreaterThan(0);
      for (const right of back.toggles) expect(right).toBeLessThan(back.x);
    });
  }
}

// Standings reads the Bowl Card's data alongside its own when this device showed the card last time (one request either way): the
// card no longer waits for the main read to finish before starting its own.
for (const returning of [false, true]) {
  test(`Standings starts the Bowl Card's read ${returning ? "alongside the main read on a returning visit" : "after the main read on a first visit"}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await signIn(page, "day");
    if (returning) await page.addInitScript(() => window.localStorage.setItem("pickem-bowl-card-shown", "1"));
    await serve(page, "regular-in");
    const started: Record<string, number> = {};
    const bowlReads: number[] = [];
    const t0 = Date.now();
    await page.route("**/api/home**", async (route) => { started.home ??= Date.now() - t0; await new Promise((resolve) => setTimeout(resolve, 600)); await route.fallback(); });
    await page.route("**/api/bowl-pool**", async (route) => { if (route.request().method() === "GET") { bowlReads.push(Date.now() - t0); started.bowl ??= Date.now() - t0; } await route.fallback(); });
    await page.goto("/");
    await page.locator(".pickem-scoreboard-ledger").waitFor({ timeout: 30_000 });
    expect(bowlReads.length, "one Bowl Card read, early or not").toBe(1);
    const gap = started.bowl - started.home;
    if (returning) expect(gap).toBeLessThan(300);
    else expect(gap).toBeGreaterThanOrEqual(500);
  });
}
