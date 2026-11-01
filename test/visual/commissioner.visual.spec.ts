import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
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
}

async function settle(page: Page, ready: string) {
  await page.goto("/admin");
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.reload();
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

// Panels are shown in every state that changes them; the rest use the healthy day.
const PANELS: Array<{ id: string; tab: number; states: string[]; open?: string[] }> = [
  { id: "today", tab: 0, states: ["healthy", "attention", "quiet"] },
  { id: "performance", tab: 1, states: ["healthy"] },
  { id: "season", tab: 2, states: ["healthy"] },
  { id: "bowl-pool", tab: 3, states: ["healthy", "attention"] },
];

for (const panel of PANELS) {
  for (const state of panel.states) {
    for (const theme of ["day", "night"]) {
      for (const [label, width] of Object.entries(WIDTHS)) {
        test(`Commissioner ${panel.id} ${state} ${theme} at ${label}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await signIn(page, theme);
          await serve(page, state);
          await settle(page, ".commissioner-panel-tab");
          await page.locator(".commissioner-panel-tab").nth(panel.tab).click();
          for (const summary of panel.open ?? []) {
            const target = page.locator("summary, details > summary").filter({ hasText: summary }).first();
            if (await target.count()) await target.click();
          }
          if (panel.id === "today" && state === "attention") {
            // Something needs the commissioner, so the repair and health drawers open by themselves. Their tools load at their own pace,
            // so prove they are open, then fold them shut: the capture is the page as it first appears.
            const drawers = page.locator(".commissioner-diagnostics > details");
            await expect(drawers.filter({ hasText: "Fix something" })).toHaveAttribute("open", "");
            await expect(drawers.filter({ hasText: "Health and safety" })).toHaveAttribute("open", "");
            await page.evaluate(() => document.querySelectorAll(".commissioner-diagnostics > details").forEach((drawer) => { (drawer as HTMLDetailsElement).open = false; }));
          }
          await page.waitForTimeout(600);
          await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
          await page.waitForFunction(() => [...document.images].every((image) => image.complete));
          await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
          await page.waitForLoadState("networkidle");
          await expect(page).toHaveScreenshot(`commissioner-${panel.id}-${state}-${theme}-${label}.png`, { fullPage: true });
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
        await page.waitForTimeout(600);
        await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
        await page.waitForFunction(() => [...document.images].every((image) => image.complete));
        await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
        await page.waitForLoadState("networkidle");
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
      await expect(page.getByText("Phone notification")).toBeVisible();
      await expect(page.frameLocator("iframe").getByRole("heading", { name: "The Bowl Pool is open" })).toBeVisible();
      await page.waitForTimeout(600);
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page).toHaveScreenshot(`commissioner-reminders-bowl-message-${theme}-${label}.png`, { fullPage: true });
    });
  }
}

// The score-polling chart (Performance tab): the first nine windows in percentages, with the emergency windows as one count.
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Commissioner polling chart day at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day");
    await serve(page, "healthy");
    await settle(page, ".commissioner-panel-tab");
    await page.locator(".commissioner-panel-tab").nth(1).click();
    const section = page.locator("section[aria-label='Fresh finals picked up by polling ladder']");
    await expect(section.locator("svg")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(600);
    await expect(section).toHaveScreenshot(`commissioner-polling-chart-day-${label}.png`);
  });
}

// The provider cost chart (Performance tab): credits per game as 15- and 30-day moving averages.
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Commissioner provider cost chart day at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day");
    await serve(page, "healthy");
    await settle(page, ".commissioner-panel-tab");
    await page.locator(".commissioner-panel-tab").nth(1).click();
    const section = page.locator("section[aria-label^='Provider cost']");
    await expect(section.locator("svg")).toBeVisible({ timeout: 30_000 });
    await page.addStyleTag({ content: ".mobile-primary-nav { visibility: hidden !important; }" });
    await page.waitForTimeout(600);
    await expect(section).toHaveScreenshot(`commissioner-provider-cost-day-${label}.png`);
  });
}

// The watchdog panel on Today (inside the "Health and safety" drawer, which the Today shots fold shut): the warnings the automation worked around, or
// the plain "No warnings this week". It opens by itself when something needs attention; on a quiet day the test opens it.
for (const [state, theme] of [["quiet", "day"], ["attention", "day"], ["attention", "night"]] as const) {
  for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
    test(`Commissioner watchdog warnings ${state} ${theme} at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, theme);
      await serve(page, state);
      await settle(page, ".commissioner-panel-tab");
      const drawer = page.locator(".commissioner-diagnostics > details").filter({ hasText: "Health and safety" });
      if ((await drawer.getAttribute("open")) === null) await drawer.locator("summary").click();
      const section = page.locator("section.commissioner-tool").filter({ hasText: "Action-only alerts" });
      await expect(section.getByText(state === "quiet" ? "No warnings this week" : "Recent warnings")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(600);
      await expect(section).toHaveScreenshot(`commissioner-watchdog-warnings-${state}-${theme}-${label}.png`);
    });
  }
}

// The last-resort final entry (Today → Fix something → Game Exceptions): an NFL game still not final past the score provider's three-day window.
// It is answered from this fixture only, so the other Today shots keep their baselines.
const OVERDUE_GAME = { id: "g-overdue", awayTeam: "Cleveland Browns", homeTeam: "Pittsburgh Steelers", week: "Week 4", kickoffAt: "2026-09-28T17:00:00Z" };

async function openLastResortFinal(page: Page) {
  await page.route("**/api/admin/game-exceptions", (route) => route.fulfill({ json: { exceptions: [], recordableGames: [OVERDUE_GAME], manualFinalGames: [OVERDUE_GAME] } }));
  await settle(page, ".commissioner-panel-tab");
  const drawer = page.locator(".commissioner-diagnostics > details").filter({ hasText: "Fix something" });
  if ((await drawer.getAttribute("open")) === null) await drawer.locator("summary").click();
  const block = page.locator("#verified-final");
  await expect(block).toBeVisible({ timeout: 30_000 });
  await block.getByLabel("Game to enter a final for").selectOption("g-overdue");
  await block.getByLabel("Cleveland Browns").fill("20");
  await block.getByLabel("Pittsburgh Steelers").fill("17");
  await block.getByLabel("Where you checked it").fill("NFL.com box score");
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

// The desk has five tabs, each with one job (the fifth, Workshop, opens full screen at its own address); repair and health tools sit in drawers on Today, and the season's checks live on Season.
test("Commissioner desk has five tabs, with repair and health in drawers on Today", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "day");
  await serve(page, "healthy");
  await settle(page, ".commissioner-panel-tab");
  const tabs = page.locator(".commissioner-panel-tab");
  await expect(tabs).toHaveCount(5);
  expect((await tabs.allInnerTexts()).map((text) => text.replace(/\d+\s*/, "").trim())).toEqual(["Today", "Performance", "Season", "Bowl Pool", "Workshop"]);
  for (const drawer of ["Fix something", "Checks and manual runs", "Health and safety"]) await expect(page.locator("summary").filter({ hasText: drawer })).toBeVisible();
  await tabs.nth(2).click();
  await expect(page.locator("summary").filter({ hasText: "Season readiness checks" })).toBeVisible();
});


// On a phone the five tabs wrap into two even rows: none sits off screen or is clipped, at the narrowest and a usual width.
for (const width of [360, 390]) {
  test(`Commissioner tabs all fit on screen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day");
    await serve(page, "healthy");
    await settle(page, ".commissioner-panel-tab");
    const fit = await page.locator(".commissioner-panel-tabs").evaluate((rail) => {
      const box = rail.getBoundingClientRect();
      const tabs = [...rail.querySelectorAll(".commissioner-panel-tab")].map((tab) => tab.getBoundingClientRect());
      return { sideways: rail.scrollWidth - rail.clientWidth, inside: tabs.every((tab) => tab.left >= box.left - 1 && tab.right <= box.right + 1 && tab.right <= window.innerWidth), rows: new Set(tabs.map((tab) => Math.round(tab.top))).size };
    });
    expect(fit.sideways).toBeLessThanOrEqual(1);
    expect(fit.inside).toBe(true);
    expect(fit.rows).toBe(2);
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

// Performance: one panel with a dropdown. The league first; choosing a player swaps every figure, including the most picked team.
test("Performance: the dropdown shows the league or one player's own stats", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day");
  await serve(page, "healthy");
  await page.goto("/admin");
  await expect(page.locator(".commissioner-panel-tab").first()).toBeVisible({ timeout: 30_000 });
  await page.locator(".commissioner-panel-tab").nth(1).click();
  const section = page.locator("[aria-labelledby=pool-stats-title]");
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
  await section.getByLabel("Show").selectOption({ label: "Connor" });
  await expect(section.locator(".pool-stats-tiles").first()).toContainText("644–466");
  await expect(section.getByRole("heading", { name: "What Connor picks" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Regular season streaks" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Season by season" })).toBeVisible();
  await expect(section.getByText("Side of the spread")).toHaveCount(0);   // the splits are one plain list: Favorites, Underdogs, Home, Away
  await expect(section.locator(".pool-stats-block").filter({ hasText: "What Connor picks" }).locator("tbody th")).toHaveText(["Favorites", "Underdogs", "Home", "Away"]);
  await section.getByLabel("Show").selectOption({ label: "Rick" });
  await expect(section.locator(".pool-stats-tiles").first()).toContainText("3 teams tied");
});

// Performance: the teams, splits and seasons tables fit their cards at every width. A card scrolls sideways only when it truly cannot fit.
for (const width of [390, 560, 768, 1280]) {
  test(`Performance: the tables fit their cards without scrolling sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day");
    await serve(page, "healthy");
    await page.goto("/admin");
    await expect(page.locator(".commissioner-panel-tab").first()).toBeVisible({ timeout: 30_000 });
    const section = page.locator("[aria-labelledby=pool-stats-title]");
    // A tab tapped before the page has finished loading its handlers does nothing, and on a busy machine that left this waiting out its whole time
    // limit: tap again until the Performance tab answers (choosing a tab twice is harmless).
    await expect(async () => {
      await page.locator(".commissioner-panel-tab").nth(1).click();
      await expect(section.getByRole("heading", { name: "Most picked teams" })).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 30_000 });
    const overflowing = await section.locator(".pool-table-wrap").evaluateAll((wraps) => wraps.filter((wrap) => wrap.scrollWidth > wrap.clientWidth + 1).length);
    expect(overflowing, "no table wider than its card").toBe(0);
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
