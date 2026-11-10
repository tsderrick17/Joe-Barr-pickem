import { expect, test, type Page } from "@playwright/test";
import { settleNetwork, signIn } from "./session";
import { BOWL_OPENING_PREVIEW, commissionerApi, NOW, PLAYERS, REMINDERS, TROPHY_ROOM } from "./commissioner-fixtures.mjs";

// The desk is one person's tool, used on a phone and a desktop: those two widths, day and night. (It was also shot at 360 and 700 wide by day, which
// added about 22 images of 1 MB each and caught nothing the 390 and 1280 shots did not.)
const WIDTHS = { "phone-390": 390, "desktop-1280": 1280 } as const;

/** Every call the desk makes is answered from fixtures; anything else is an empty 204, and no write ever reaches a server. */
async function serve(page: Page, state: string) {
  const api = commissionerApi(state) as Record<string, unknown>;
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\//, "");
    if (route.request().method() !== "GET") return route.fulfill({ status: 204, body: "" });
    if (path === "profile") return route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } });
    if (path === "admin/players") return route.fulfill({ json: PLAYERS });
    if (path === "admin/reminders") return route.fulfill({ json: REMINDERS });
    if (path === "trophy-room") return route.fulfill({ json: TROPHY_ROOM });
    if (path === "pool-chat") return route.fulfill({ json: { messages: [] } });
    if (path in api) return route.fulfill({ json: api[path] });
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(NOW) });
  // The dial's "drag to turn" hint shows on the first three visits and fades after four seconds; screenshots are taken as on a later visit.
  await page.addInitScript(() => window.localStorage.setItem("commissioner-dial-hint", "3"));
}

async function settle(page: Page, ready: string, path = "/admin") {
  await page.goto(path);
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".cw-shell[data-status=ready]")).toBeAttached({ timeout: 30_000 });   // the live status is in, so titles and rings are final
  await page.evaluate(() => document.fonts.ready);
  await page.reload();
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
  await settleNetwork(page);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

// The wheel and every page it opens, in each state that changes them; the rest use the healthy day. The dial along the bottom is in every page shot.
const PAGES: Array<{ id: string; path: string; ready: string; states: string[] }> = [
  { id: "wheel", path: "/admin", ready: ".cw-hub", states: ["healthy", "attention", "quiet"] },
  { id: "gameday", path: "/admin/gameday", ready: ".commissioner-flow", states: ["healthy", "attention", "quiet"] },
  { id: "health", path: "/admin/health", ready: ".cw-page-head", states: ["healthy", "attention"] },
  { id: "stats", path: "/admin/stats", ready: ".pool-stats-tiles", states: ["healthy"] },
  { id: "odds", path: "/admin/odds", ready: ".cw-page-head", states: ["healthy"] },
  { id: "limits", path: "/admin/limits", ready: ".cw-page-head", states: ["healthy"] },
  { id: "season", path: "/admin/season", ready: ".cw-page-head", states: ["healthy"] },
  { id: "bowl-pool", path: "/admin/bowl-pool", ready: ".cw-page-head", states: ["healthy", "attention"] },
];

for (const view of PAGES) {
  for (const state of view.states) {
    for (const theme of ["day", "night"]) {
      for (const [label, width] of Object.entries(WIDTHS)) {
        test(`Commissioner ${view.id} ${state} ${theme} at ${label}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await signIn(page, theme);
          await serve(page, state);
          await settle(page, view.ready, view.path);
          await page.waitForTimeout(1600);   // the dial settles on its page (a 1.4 s swing)
          await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
          await page.waitForFunction(() => [...document.images].every((image) => image.complete));
          await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
          await settleNetwork(page);
          await expect(page).toHaveScreenshot(`commissioner-${view.id}-${state}-${theme}-${label}.png`, { fullPage: true });
        });
      }
    }
  }
}

// The Players, Email center (reminders) and Trophy room pages.
for (const [name, path, ready] of [["players", "/admin/players", "h1, h2"], ["reminders", "/admin/reminders", "h1, h2"], ["trophy-room", "/trophy-room", "table"]] as const) {
  for (const theme of ["day", "night"]) {
    for (const [label, width] of Object.entries(WIDTHS)) {
      test(`Commissioner ${name} ${theme} at ${label}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await signIn(page, theme);
        await serve(page, "healthy");
        await page.goto(path);
        await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.reload();
        await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        if (path.startsWith("/admin")) await expect(page.locator(".cw-shell[data-status=ready]")).toBeAttached({ timeout: 30_000 });
        await page.waitForTimeout(1600);   // the dial settles
        await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
        await page.waitForFunction(() => [...document.images].every((image) => image.complete));
        await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
        await settleNetwork(page);
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await expect(page).toHaveScreenshot(`commissioner-${name}-${theme}-${label}.png`, { fullPage: true });
      });
    }
  }
}

// The Email center with the email image studio open on the Bowl Pool opening announcement: its subject and phone message are shown as fixed words (not edit boxes),
// beside the "Send this to my email and phone" button and the email itself.
for (const theme of ["day", "night"]) {
  for (const [label, width] of Object.entries(WIDTHS)) {
    test(`Commissioner reminders Bowl announcement preview ${theme} at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, theme);
      await serve(page, "healthy");
      await page.route("**/api/admin/reminder-templates", (route) => route.fulfill({ json: { templates: [] } }));
      await page.route("**/api/admin/reminders/preview", async (route) => {
        const { templateId } = route.request().postDataJSON();
        return route.fulfill({ json: templateId === "bowl_pool_open" ? BOWL_OPENING_PREVIEW : { html: "<p>Sample</p>", images: [], source: "Sample", warning: "", templateId } });
      });
      await page.goto("/admin/reminders");
      await expect(page.getByRole("heading", { name: "Email image studio" })).toBeVisible({ timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole("button", { name: "Open email image studio" }).click();
      await page.getByLabel("Email type").selectOption("bowl_pool_open");
      await expect(page.getByText("Phone notification")).toBeVisible({ timeout: 30_000 });
      await expect(page.frameLocator("iframe").getByRole("heading", { name: "The Bowl Pool is open" })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".cw-shell[data-status=ready]")).toBeAttached({ timeout: 30_000 });
      await page.waitForTimeout(1600);   // the dial settles (a 1.4 s swing)
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page).toHaveScreenshot(`commissioner-reminders-bowl-message-${theme}-${label}.png`, { fullPage: true });
    });
  }
}

// The score-polling chart (Odds credits page): the first nine windows in percentages, with the emergency windows as one count.
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Commissioner polling chart day at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day");
    await serve(page, "healthy");
    await settle(page, ".cw-page-head", "/admin/odds");
    const section = page.locator("section[aria-label='Fresh finals picked up by polling ladder']");
    await expect(section.locator("svg")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(600);
    await expect(section).toHaveScreenshot(`commissioner-polling-chart-day-${label}.png`);
  });
}

// The score-checking line on the Odds credits page: Normal, and the three schedules the low-balance rule can switch to, each with its reason in plain words.
for (const tier of ["normal", "lean", "minimal", "paused"] as const) {
  for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
    test(`Commissioner score checking ${tier} day at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "day");
      await serve(page, tier === "normal" ? "healthy" : tier);
      await settle(page, ".cw-page-head", "/admin/odds");
      const section = page.locator("section[aria-label='Monthly provider credit usage']");
      await expect(section.locator("svg").first()).toBeVisible({ timeout: 30_000 });
      await page.addStyleTag({ content: ".mobile-primary-nav { visibility: hidden !important; }" });
      await page.waitForTimeout(600);
      await expect(section).toHaveScreenshot(`commissioner-score-checking-${tier}-day-${label}.png`);
    });
  }
}

// The provider cost chart (Odds credits page): credits per game as 15- and 30-day moving averages.
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Commissioner provider cost chart day at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day");
    await serve(page, "healthy");
    await settle(page, ".cw-page-head", "/admin/odds");
    const section = page.locator("section[aria-label^='Provider cost']");
    await expect(section.locator("svg")).toBeVisible({ timeout: 30_000 });
    await page.addStyleTag({ content: ".mobile-primary-nav { visibility: hidden !important; }" });
    await page.waitForTimeout(600);
    await expect(section).toHaveScreenshot(`commissioner-provider-cost-day-${label}.png`);
  });
}

// The watchdog panel on the Health page: the warnings the automation worked around, or the plain "No warnings this week".
for (const [state, theme] of [["quiet", "day"], ["attention", "day"], ["attention", "night"]] as const) {
  for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
    test(`Commissioner watchdog warnings ${state} ${theme} at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, theme);
      await serve(page, state);
      await settle(page, ".cw-page-head", "/admin/health");
      const section = page.locator("section.commissioner-tool").filter({ hasText: "Action-only alerts" });
      await expect(section.getByText(state === "quiet" ? "No warnings this week" : "Recent warnings")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(600);
      await expect(section).toHaveScreenshot(`commissioner-watchdog-warnings-${state}-${theme}-${label}.png`);
    });
  }
}

// The last-resort final entry (Game day → Fix something → Game Exceptions): an NFL game still not final past the score provider's three-day window.
// It is answered from this fixture only, so the other Game day shots keep their baselines.
const OVERDUE_GAME = { id: "g-overdue", awayTeam: "Cleveland Browns", homeTeam: "Pittsburgh Steelers", week: "Week 4", kickoffAt: "2026-09-28T17:00:00Z" };

async function openLastResortFinal(page: Page) {
  await page.route("**/api/admin/game-exceptions", (route) => route.fulfill({ json: { exceptions: [], recordableGames: [OVERDUE_GAME], manualFinalGames: [OVERDUE_GAME] } }));
  await settle(page, ".cw-page-head", "/admin/gameday");
  const block = page.locator("#verified-final");
  await expect(block).toBeVisible({ timeout: 30_000 });
  await block.getByRole("button", { name: /Cleveland Browns at Pittsburgh Steelers/ }).click();
  await block.getByLabel("Cleveland Browns").fill("20");
  await block.getByLabel("Pittsburgh Steelers").fill("17");
  await block.getByLabel("Where you checked it").fill("NFL.com box score");
  await block.getByLabel("Where you checked it").blur();
  return block;
}

for (const theme of ["day", "night"] as const) {
  for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
    test(`Commissioner last-resort final entry ${theme} at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, theme);
      await serve(page, "healthy");
      const block = await openLastResortFinal(page);
      await expect(block.getByRole("button", { name: "Save verified final" })).toBeEnabled();
      await page.waitForTimeout(600);
      await expect(block).toHaveScreenshot(`commissioner-last-resort-final-${theme}-${label}.png`);
    });
  }
}

test("Commissioner last-resort final asks first, then sends the scores and the note, and says what was graded", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "day");
  await serve(page, "healthy");
  let sent: unknown = null;
  await page.route("**/api/admin/verified-final", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { message: "Final saved: 20 to 17. 3 ATS and 1 Survivor pick graded." } });
  });
  const block = await openLastResortFinal(page);
  const button = block.getByRole("button", { name: "Save verified final" });
  let asked = "";
  page.once("dialog", (dialog) => { asked = dialog.message(); void dialog.dismiss(); });
  await button.click();
  await expect.poll(() => asked).toContain("Cleveland Browns 20, Pittsburgh Steelers 17");
  expect(sent, "declining the question sends nothing").toBeNull();
  page.once("dialog", (dialog) => { void dialog.accept(); });
  await button.click();
  await expect(page.getByText("Final saved: 20 to 17. 3 ATS and 1 Survivor pick graded.")).toBeVisible();
  expect(sent).toEqual({ gameId: "g-overdue", awayScore: 20, homeScore: 17, source: "NFL.com box score" });
});

// The wheel has ten spokes, each opening its own page; the old tabs' tools are all still there, as plain sections (no fold-down drawers).
test("Commissioner wheel: ten spokes, each opens its page, and the tools are in view", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "day");
  await serve(page, "healthy");
  await settle(page, ".cw-hub");
  const spokes = page.locator(".cw-spoke");
  await expect(spokes).toHaveCount(10);
  expect((await spokes.locator(".cw-name").allInnerTexts()).map((text) => text.trim())).toEqual(["Game day", "Health", "Messages", "Players", "Bowl Pool", "Season", "Pool stats", "Odds credits", "Free limits", "Workshop"]);
  await expect(async () => {
    await page.getByRole("button", { name: /^Game day:/ }).click();
    await expect(page).toHaveURL(/\/admin\/gameday$/, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Game day" })).toBeFocused();
  for (const title of ["Fix something", "Checks and manual runs"]) await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  await expect(page.locator(".commissioner-diagnostics")).toHaveCount(0);   // the old fold-down drawers
  await page.goto("/admin/health");
  await expect(page.getByRole("heading", { level: 2, name: "Alerts and sign-in" })).toBeVisible({ timeout: 30_000 });
  await page.goto("/admin/season");
  await expect(page.getByRole("heading", { level: 2, name: "Season readiness checks" })).toBeVisible({ timeout: 30_000 });
});

// The hub counts what needs the Commissioner and opens the list; each line goes to the page that fixes it.
test("Commissioner wheel: Needs you lists what needs attention, with a way there", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day");
  await serve(page, "attention");
  await settle(page, ".cw-hub");
  const hub = page.locator(".cw-hub");
  await expect(hub.locator("b")).toHaveText("2", { timeout: 30_000 });
  await hub.click();
  const sheet = page.getByRole("dialog", { name: "Needs you" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".cw-needs li")).toHaveCount(2);
  await page.waitForTimeout(400);
  await expect(page).toHaveScreenshot("commissioner-wheel-needs-you-day-phone-390.png");
  await sheet.getByRole("link", { name: "Go" }).last().click();
  await expect(page).toHaveURL(/\/admin\/health$/);
});

// The dial: drag and let go opens the page in the middle; sliding up off the dial before letting go cancels; the arrow keys turn it one page;
// the Wheel button goes home; the browser's Back button returns to the page before.
test("Commissioner dial: drag to open, slide up to cancel, keys, Wheel and Back", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await signIn(page, "day");
  await serve(page, "healthy");
  await settle(page, ".cw-page-head", "/admin/health");
  const dial = page.locator(".cw-dial");
  await expect(dial.locator(".cw-dk[aria-current=page]")).toHaveAttribute("aria-label", /^Health/);
  await page.waitForTimeout(1600);
  const box = (await dial.boundingBox())!;
  const middle = { x: box.x + box.width / 2, y: box.y + 36 };
  const drag = async (dx: number, dy = 0) => {
    await page.mouse.move(middle.x, middle.y);
    await page.mouse.down();
    for (let step = 1; step <= 10; step += 1) await page.mouse.move(middle.x + (dx * step) / 10, middle.y + (dy * step) / 10);
    await page.waitForTimeout(200);   // hold still, so letting go is not a flick
    await page.mouse.up();
  };
  const gap = await page.evaluate(() => Math.min(64, Math.max(36, (window.innerWidth - 150) / 4)));
  await drag(-gap, -box.height);   // slide up off the dial: nothing opens
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/\/admin\/health$/);
  await drag(-gap);   // one notch to the left brings the next page, Messages, to the middle
  await expect(page).toHaveURL(/\/admin\/reminders$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
  await page.locator("body").press("ArrowLeft");
  await expect(page).toHaveURL(/\/admin\/health$/, { timeout: 30_000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/reminders$/, { timeout: 30_000 });
  await dial.getByRole("link", { name: "Back to the wheel" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
  await expect(page.locator(".cw-dial")).toHaveCount(0);
});

// The wheel and the dial fit a small phone: nothing off screen, no sideways scrolling.
for (const width of [360, 390]) {
  test(`Commissioner wheel and dial fit on screen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page, "day");
    await serve(page, "healthy");
    await settle(page, ".cw-hub");
    const wheel = (await page.locator(".cw-wheel").boundingBox())!;
    expect(wheel.x).toBeGreaterThanOrEqual(0);
    expect(wheel.x + wheel.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.goto("/admin/gameday");
    await expect(page.locator(".cw-dial")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1600);
    const label = (await page.locator(".cw-dial-label").boundingBox())!;
    expect(label.x).toBeGreaterThanOrEqual(0);
    expect(label.x + label.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}

// The all-time table has just wins and hit rate, and each sorts on its own: Connor has the best hit rate, Tyler the most wins. Hit rate
// ranks players with enough picks first, so a young player with a high rate sits under them.
test("Trophy room: wins and hit rate sort independently", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day");
  await serve(page, "healthy");
  await page.goto("/trophy-room");
  const table = page.locator(".trophy-table");
  await expect(table).toBeVisible({ timeout: 30_000 });
  const firstName = () => table.locator("tbody th[scope=row]").first().innerText();
  await expect(table.locator("thead th")).toHaveText(["Rank", "Player", "Wins", "Hit rate ▼", "Perfect Weeks"]);
  expect(await firstName()).toBe("Connor");
  await table.getByRole("button", { name: /^Wins/ }).click();
  expect(await firstName()).toBe("Tyler");
  await expect(table.locator("thead th").nth(2)).toHaveAttribute("aria-sort", "descending");
  await expect(table.locator("thead th").nth(3)).toHaveAttribute("aria-sort", "none");
  await table.getByRole("button", { name: /^Wins/ }).click();
  expect(await firstName()).not.toBe("Tyler");
  await table.getByRole("button", { name: /^Hit rate/ }).click();
  expect(await firstName()).toBe("Connor");
  // Al (20 wins, .588 on 34 picks) is under the pick minimum, so a hit-rate sort puts him after the qualified players.
  const names = await table.locator("tbody th[scope=row]").allInnerTexts();
  expect(names.indexOf("Al")).toBeGreaterThan(names.indexOf("Ron"));
  // Perfect Weeks (how many 2-0 weeks in all): Tyler 14, Connor 12, Gary 9, Rick 6, and the players with no completed weeks last.
  await table.getByRole("button", { name: /^Perfect Weeks/ }).click();
  expect((await table.locator("tbody th[scope=row]").allInnerTexts()).slice(0, 4)).toEqual(["Tyler", "Connor", "Gary", "Rick"]);
  await expect(table.locator("tbody tr").first().locator("td").last()).toHaveText("14");
});

// The Trophy Room's table carries each player's streaks, as now / best: Tyler has gone 9 weeks in a row with a win (best 23) and none 2-0 right now (best 5).
test("Trophy room: the table shows each player's streaks", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "day");
  await serve(page, "healthy");
  await page.goto("/trophy-room");
  await page.getByRole("button", { name: "Other Stats" }).click();   // the streaks are in the second view of the table
  const row = page.locator(".trophy-table tbody tr").filter({ has: page.getByRole("rowheader", { name: "Tyler" }) });
  await expect(row.getByLabel("Shutout Free Weeks in a Row: 9 now, 23 best")).toBeVisible({ timeout: 30_000 });
  await expect(row.getByLabel("Perfect Weeks in a Row: 0 now, 5 best")).toBeVisible();
  const noPicks = page.locator(".trophy-table tbody tr").filter({ has: page.getByRole("rowheader", { name: "Zac" }) });
  await expect(noPicks.getByLabel("Shutout Free Weeks in a Row: none yet")).toBeVisible();
});

// The second view of the table: streaks, games decided by half a point (wins, losses and hit rate) and pushes picked, ranked on the sorted column with
// ties sharing a place (Ron, Al, Dana and Zac have no streaks, so they are all tied for 5th).
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Trophy room: the Other Stats view at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day");
    await serve(page, "healthy");
    await page.goto("/trophy-room");
    const table = page.locator(".trophy-table");
    await expect(table).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Other Stats" }).click();
    await expect(table.locator("thead th")).toHaveText(["", "Regular Season Streaks", "Decided by a half point", "", "Player ▲", "Shutout Free Weeks in a Row", "Perfect Weeks in a Row", "Wins", "Losses", "Hit rate", "Pushes picked"]);
    // no places on this page: players are listed A to Z until a column is chosen
    await expect(table.locator(".trophy-rank")).toHaveCount(0);
    expect(await table.locator("tbody th[scope=row]").allInnerTexts()).toEqual(["Al", "Connor", "Dana", "Gary", "Rick", "Ron", "Tyler", "Zac"]);
    const tyler = table.locator("tbody tr").filter({ has: page.getByRole("rowheader", { name: "Tyler" }) });
    await expect(tyler.locator("td").nth(2)).toHaveText("6");   // half-point wins
    await expect(tyler.locator("td").nth(3)).toHaveText("4");   // half-point losses
    await expect(tyler.locator("td").nth(4)).toHaveText(".600");   // half-point hit rate: 6 wins in 10 games
    await expect(tyler.locator("td").nth(5)).toHaveText("3");   // pushes picked
    await table.getByRole("button", { name: /^Pushes picked/ }).click();
    expect(await table.locator("tbody th[scope=row]").first().innerText()).toBe("Connor");   // 4 pushes
    await table.getByRole("button", { name: /^Shutout Free Weeks in a Row/ }).click();
    expect(await table.locator("tbody th[scope=row]").first().innerText()).toBe("Tyler");   // best run 23
    await table.getByRole("button", { name: /^Player/ }).click();
    expect(await table.locator("tbody th[scope=row]").first().innerText()).toBe("Al");   // back to A to Z
    await table.getByRole("button", { name: /^Player/ }).click();
    expect(await table.locator("tbody th[scope=row]").first().innerText()).toBe("Zac");   // a second tap reverses
    await table.getByRole("button", { name: /^Player/ }).click();
    await page.addStyleTag({ content: ".mobile-primary-nav { visibility: hidden !important; }" });
    await expect(page.locator("#all-time")).toBeVisible();
    await expect(page.locator("section[aria-labelledby=all-time]")).toHaveScreenshot(`commissioner-trophy-room-more-${label}.png`);
  });
}

// Pool stats: one panel with a dropdown. The league first; choosing a player swaps every figure, including the most picked team.
test("Pool stats: the dropdown shows the league or one player's own stats", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day");
  await serve(page, "healthy");
  await page.goto("/admin/stats");
  const section = page.locator("[aria-labelledby=pool-stats-title]");
  await expect(section.getByLabel("Show")).toBeVisible({ timeout: 30_000 });
  await expect(section.getByLabel("Show")).toHaveValue("league", { timeout: 30_000 });
  await expect(section.locator(".pool-stats-tiles").first()).toContainText("2,418–2,077");
  await expect(section.locator(".pool-stats-tiles").first()).toContainText("Kansas City Chiefs");
  await expect(section.getByRole("heading", { name: "Donut Free Weeks" })).toHaveCount(0);   // the league has no streak boards: the streaks are in the Trophy Room
  await expect(section.getByText("Neutral site")).toHaveCount(0);
  await expect(section.getByRole("heading", { name: "Season by season" })).toBeVisible();   // the league has its seasons too
  await expect(section.getByRole("heading", { name: "Most picked teams" })).toBeVisible();
  await section.getByRole("button", { name: /^Hit rate/ }).click();   // the same five-team table, now the five with the best hit rate
  await expect(section.getByRole("heading", { name: "Best hit rate teams" })).toBeVisible();
  await section.getByRole("button", { name: /^Picked/ }).click();
  await expect(section.getByRole("heading", { name: "Most picked teams" })).toBeVisible();
  // Pressing the chosen column again turns the table over: the five least picked, then the five with the lowest hit rate; once more turns it back.
  const teamBlock = section.locator(".pool-stats-block").filter({ has: page.locator("button.pool-sort") });
  const teamRows = teamBlock.locator("tbody th");
  await expect(teamRows.first()).toHaveText("Kansas City Chiefs");
  await expect(teamBlock.getByRole("button", { name: /^Picked/ })).toContainText("▼");
  await section.getByRole("button", { name: /^Picked/ }).click();
  await expect(section.getByRole("heading", { name: "Least picked teams" })).toBeVisible();
  await expect(section.getByText("The five teams the league took least often.")).toBeVisible();
  await expect(teamBlock.getByRole("button", { name: /^Picked/ })).toContainText("▲");
  await expect(teamBlock.locator("th[aria-sort=ascending]")).toHaveCount(1);
  await expect(teamRows).toHaveText(["Detroit Lions", "San Francisco 49ers", "Philadelphia Eagles", "Buffalo Bills", "Kansas City Chiefs"]);
  await section.getByRole("button", { name: /^Picked/ }).click();
  await expect(section.getByRole("heading", { name: "Most picked teams" })).toBeVisible();
  await expect(teamBlock.getByRole("button", { name: /^Picked/ })).toContainText("▼");
  await section.getByRole("button", { name: /^Hit rate/ }).click();
  await expect(section.getByRole("heading", { name: "Best hit rate teams" })).toBeVisible();   // another column starts at the top again
  await section.getByRole("button", { name: /^Hit rate/ }).click();
  await expect(section.getByRole("heading", { name: "Lowest hit rate teams" })).toBeVisible();
  await expect(section.getByText("The five teams the league hit least often.")).toBeVisible();
  await expect(teamRows).toHaveText(["San Francisco 49ers", "Philadelphia Eagles", "Detroit Lions", "Buffalo Bills", "Kansas City Chiefs"]);
  await section.getByRole("button", { name: /^Picked/ }).click();   // back to Picked: highest first
  await expect(section.getByRole("heading", { name: "Most picked teams" })).toBeVisible();
  await section.getByLabel("Show").selectOption({ label: "Connor" });
  await expect(section.locator(".pool-stats-tiles").first()).toContainText("644–466");
  await expect(section.getByRole("heading", { name: "What Connor picks" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Regular season streaks" })).toHaveCount(0);   // streaks live in the Trophy Room, not here
  await expect(section.getByRole("heading", { name: "Season by season" })).toBeVisible();
  await expect(section.getByText("Side of the spread")).toHaveCount(0);   // the splits are one plain list: Favorites, Underdogs, Pick'em, Home, Away
  await expect(section.locator(".pool-stats-block").filter({ hasText: "What Connor picks" }).locator("tbody th")).toHaveText(["Favorites", "Underdogs", "Pick’em", "Home", "Away"]);
  await section.getByLabel("Show").selectOption({ label: "Rick" });
  await expect(section.locator(".pool-stats-tiles").first()).toContainText("3 teams tied");
});

// Pool stats: the teams, splits and seasons tables fit their cards at every width. A card scrolls sideways only when it truly cannot fit.
for (const width of [390, 560, 768, 1280]) {
  test(`Pool stats: the tables fit their cards without scrolling sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day");
    await serve(page, "healthy");
    await page.goto("/admin/stats");
    const section = page.locator("[aria-labelledby=pool-stats-title]");
    await expect(section.getByRole("heading", { name: "Most picked teams" })).toBeVisible({ timeout: 30_000 });
    const overflowing = await section.locator(".pool-table-wrap").evaluateAll((wraps) => wraps.filter((wrap) => wrap.scrollWidth > wrap.clientWidth + 1).length);
    expect(overflowing, "no table wider than its card").toBe(0);
    // The teams and splits tables show every row: no scroll bar, at any width.
    for (const heading of ["Most picked teams", "What the league picks"]) {
      const wrap = section.locator(".pool-stats-block").filter({ has: page.getByRole("heading", { name: heading }) }).locator(".pool-table-wrap");
      const taller = await wrap.evaluate((element) => element.scrollHeight - element.clientHeight);
      expect(taller, `${heading}: nothing to scroll`).toBeLessThanOrEqual(1);
      expect(await wrap.evaluate((element) => getComputedStyle(element).overflowY), `${heading}: not a vertical scroller`).not.toBe("scroll");
    }
  });
}

// Record / Other Stats is a two-way switch: tapping either half flips to the other view, and the halves are exactly the same size.
test("either half of the Record / Other Stats switch flips the All-Time Table", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day");
  await serve(page, "healthy");
  await page.goto("/trophy-room");
  const switcher = page.getByRole("group", { name: "Table view" });
  const record = switcher.getByRole("button", { name: "Record" }), other = switcher.getByRole("button", { name: /Other\s*Stats/ });
  await expect(record).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  const [a, b] = [await record.boundingBox(), await other.boundingBox()];
  expect([Math.round(a!.width), Math.round(a!.height)], "the halves are the same size").toEqual([Math.round(b!.width), Math.round(b!.height)]);
  await record.click();   // the half that is already chosen: flips to the other view
  await expect(other).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".trophy-table")).toHaveAttribute("data-view", "more");
  await other.click();
  await expect(record).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".trophy-table")).toHaveAttribute("data-view", "record");
});
