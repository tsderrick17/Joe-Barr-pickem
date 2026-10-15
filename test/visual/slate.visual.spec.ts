import { expect, test, type Page } from "@playwright/test";
import { boardResponse, SCENARIOS } from "./slate-fixtures.mjs";

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-900": 900, "desktop-1280": 1280 } as const;

/** A stored, far-future session so the page treats the browser as signed in. Never sent anywhere real. */
async function signIn(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "visual-player", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "visual-player", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await page.addInitScript((value) => {
    window.localStorage.setItem("sb-placeholder-auth-token", value);
    window.localStorage.setItem("pickem-theme", "day");
  }, JSON.stringify(session));
}

async function serve(page: Page, scenario: string) {
  const board = boardResponse(scenario);
  // Registered first so the specific routes below win (Playwright runs the
  // newest matching route first): nothing else under /api reaches a server.
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/board**", (route) => route.fulfill({ json: board }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(board.serverTime) });
}

for (const scenario of Object.keys(SCENARIOS)) {
  for (const [label, width] of Object.entries(WIDTHS)) {
    test(`Slate ${scenario} at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page);
      await serve(page, scenario);
      // First visit caches fonts and images; the capture is the reload, the way a
      // returning player sees it. (Completed rows measure their picker names
      // once fonts are present, so a cold first paint is not deterministic.)
      await page.goto("/board");
      await expect(page.locator(".slate-game-row").first()).toBeVisible({ timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.reload();
      await expect(page.locator(".slate-game-row").first()).toBeVisible({ timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      // Lazy images below the fold load only when scrolled near; touch the
      // whole page, then wait until every image has finished.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 30)); }
        window.scrollTo(0, 0);
      });
      // Lazy images below the fold load only when scrolled near; make them all load now.
      await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
      await page.waitForLoadState("networkidle");
      // The Next.js development badge is not part of the product.
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page).toHaveScreenshot(`${scenario}-${label}.png`, { fullPage: true });
    });
  }
}

// Choosing a third pick when two are saved raises the receipt's warning tab, which has the same die-cut corners.
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Slate receipt warning at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await serve(page, "upcoming-picked");
    await page.goto("/board");
    await expect(page.locator(".slate-game-row").first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".slate-game-row button.slate-team-side:not([disabled])").nth(8).click();
    await expect(page.locator(".slate-receipt-warning")).toBeVisible();
    // The notice covers the board; it never adds height to the ticket.
    const heights = await page.evaluate(() => {
      const strip = document.querySelector(".slate-receipt-strip")!.getBoundingClientRect(), note = document.querySelector(".slate-receipt-warning")!.getBoundingClientRect();
      return { strip: strip.height, gap: Math.abs(note.top - strip.bottom) };
    });
    expect(heights.gap).toBeLessThanOrEqual(2);
    expect(heights.strip).toBeLessThan(140);
    await page.waitForTimeout(600);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const box = (await page.locator(".slate-receipt-strip").boundingBox())!;
    await expect(page).toHaveScreenshot(`receipt-warning-${label}.png`, { clip: { x: Math.max(0, box.x - 8), y: box.y - 8, width: Math.min(width, box.width + 16), height: box.height + 140 } });
  });
}

// An early-lock note is one line under the spread: the spread stays level with the team names, and the note stays inside its row
// and clear of the poker chips, at every width.
for (const width of [360, 390, 700, 1280]) {
  for (const scenario of ["upcoming-unpicked", "upcoming-no-survivor"]) {
    test(`Slate early-lock note keeps the line level and tidy (${scenario}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page);
      await serve(page, scenario);
      await page.goto("/board");
      const note = page.locator(".slate-lock-note").first();
      await note.waitFor({ timeout: 30_000 });
      const layout = await note.evaluate((element) => {
        const row = element.closest(".slate-game-row")!;
        const box = element.getBoundingClientRect(), rowBox = row.getBoundingClientRect();
        const spread = row.querySelector(".slate-spread-cell span")!.getBoundingClientRect();
        const name = row.querySelector(".slate-team-label")!.getBoundingClientRect();
        const chips = [...row.querySelectorAll("button")].map((chip) => chip.getBoundingClientRect()).filter((chip) => chip.width > 20 && chip.width < 80);
        return {
          lines: Math.round(box.height / parseFloat(getComputedStyle(element).lineHeight)),
          insideRow: box.top >= rowBox.top && box.bottom <= rowBox.bottom,
          clearOfChips: chips.every((chip) => box.right <= chip.left || box.left >= chip.right || box.bottom <= chip.top + 6 || box.top >= chip.bottom - 6),
          offset: Math.abs((spread.top + spread.bottom) / 2 - (name.top + name.bottom) / 2),
        };
      });
      expect(layout.lines).toBe(1);
      expect(layout.insideRow).toBe(true);
      expect(layout.clearOfChips).toBe(true);
      expect(layout.offset).toBeLessThanOrEqual(1);
    });
  }
}

// The Survivor instruction is only for a player who can still pick that week: shown while they are in, gone once they are out.
for (const [scenario, shown] of [["upcoming-unpicked", true], ["upcoming-no-survivor", false]] as const) {
  test(`Slate Survivor instruction ${shown ? "shows" : "is gone"} (${scenario})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await signIn(page);
    await serve(page, scenario);
    await page.goto("/board");
    await page.locator(".slate-game-row").first().waitFor({ timeout: 30_000 });
    await expect(page.getByText("Click a poker chip to choose a team.")).toHaveCount(shown ? 1 : 0);

// The Pick'em line at the foot of the ticket ("1/2 · CHANGED · 1 DUE") stays on one line and inside its section at every width, in the
// longest states: one team picked and unsaved, and a live week with locked picks.
for (const width of [360, 390, 700]) {
  for (const [scenario, pick] of [["upcoming-unpicked", true], ["upcoming-picked", false], ["live-survivor", false]] as const) {
    test(`Slate ticket status line is one line (${scenario}${pick ? ", one team picked" : ""}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page);
      await serve(page, scenario);
      await page.goto("/board");
      await page.locator(".slate-game-row").first().waitFor({ timeout: 30_000 });
      if (pick) await page.locator(".slate-game-row button.slate-team-side:not([disabled])").first().click();
      const line = page.locator(".slate-receipt-pickem > em");
      await expect(line).toBeVisible();
      const fit = await line.evaluate((element) => {
        const box = element.getBoundingClientRect(), section = element.parentElement!.getBoundingClientRect();
        return { lines: Math.round(box.height / parseFloat(getComputedStyle(element).lineHeight)), inside: element.scrollWidth <= element.clientWidth + 1 && box.right <= section.right + 1, text: element.textContent };
      });
      expect(fit.lines, fit.text ?? "").toBe(1);
      expect(fit.inside, fit.text ?? "").toBe(true);
    });
  }
}

// The ticket starts in the same place as the Bowl Pool's: flush under the menu, with the week picker and instructions below it.
for (const width of [390, 1280]) {
  test(`Slate ticket starts flush under the menu (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await serve(page, "upcoming-unpicked");
    await page.goto("/board");
    await page.locator(".slate-game-row").first().waitFor({ timeout: 30_000 });
    const tops = await page.evaluate(() => ({
      ticket: document.querySelector(".slate-receipt-strip")!.getBoundingClientRect().top,
      page: document.querySelector("main")!.getBoundingClientRect().top,
      header: document.querySelector(".slate-action-instructions")!.getBoundingClientRect().top,
      ticketBottom: document.querySelector(".slate-receipt-strip")!.getBoundingClientRect().bottom,
    }));
    expect(Math.abs(tops.ticket - tops.page)).toBeLessThanOrEqual(1);
    expect(tops.header).toBeGreaterThan(tops.ticketBottom);
  });
}
