import { expect, test, type Page } from "@playwright/test";
import { commissionerApi, NOW, PLAYERS, REMINDERS } from "./commissioner-fixtures.mjs";

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-1280": 1280 } as const;

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
  { id: "workshop", tab: 4, states: ["healthy"] },
];

for (const panel of PANELS) {
  for (const state of panel.states) {
    for (const theme of ["day", "night"]) {
      for (const [label, width] of Object.entries(WIDTHS)) {
        if (theme === "night" && width !== 390 && width !== 1280) continue;
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
          // The loading football is stepped by script, which a screenshot cannot pause: hold it on its first frame.
          if (panel.id === "workshop") await page.addStyleTag({ content: ".football-loader-ball { background-position: 0 0 !important; }" });
          await expect(page).toHaveScreenshot(`commissioner-${panel.id}-${state}-${theme}-${label}.png`, { fullPage: true });
        });
      }
    }
  }
}

// The Players and Reminders pages.
for (const [name, path, ready] of [["players", "/admin/players", "h1, h2"], ["reminders", "/admin/reminders", "h1, h2"]] as const) {
  for (const theme of ["day", "night"]) {
    for (const [label, width] of Object.entries(WIDTHS)) {
      if (theme === "night" && width !== 390 && width !== 1280) continue;
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

// The desk has five tabs, each with one job; repair and health tools sit in drawers on Today, and the season's checks live on Season.
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


// The Workshop: every piece can be handled. Football: pause on a chosen frame and the ball sits on it; settings can be reset to live and
// copied; typed words and numbers reach the pieces; the chip has every NFL team.
test("Workshop pieces respond to hands: scrub the football, reset and copy settings, type words, pick teams", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "day");
  await serve(page, "healthy");
  await settle(page, ".commissioner-panel-tab");
  await page.locator(".commissioner-panel-tab").nth(4).click();
  await expect(page.getByRole("heading", { name: "Workshop" })).toBeVisible({ timeout: 30_000 });

  // Football: paused on frame 10, the ball's animation is parked at that frame's moment of the turn.
  const football = page.locator(".asset-card", { hasText: "Loading football" });
  await football.getByRole("button", { name: "Pause" }).click();
  await football.getByLabel("Football frame").fill("10");
  await expect(football.locator("output").first()).toHaveText("10/108");
  const delay = await football.locator(".football-loader-ball").evaluate((ball) => parseFloat(getComputedStyle(ball).animationDelay));
  expect(delay).toBeCloseTo(-((108 - 10 + 0.5) / 108) * 1.8, 1);
  await football.getByRole("button", { name: "Step on" }).click();
  await expect(football.locator("output").first()).toHaveText("11/108");
  await football.getByRole("button", { name: "Play" }).click();
  await expect(football.locator("output").first()).toHaveText("playing");

  // Settings: change one, see it in Your settings, copy text names it, reset to live clears it.
  const settings = page.locator(".asset-settings pre");
  await expect(settings).toHaveText("Every setting is at its live value.");
  await football.locator(".asset-knob", { hasText: "Time per turn" }).locator("input").fill("3");
  await expect(settings).toContainText("Time per turn (--football-spin-s): 3s, live 1.8s");
  await football.getByRole("button", { name: "Live values" }).click();
  await expect(settings).toHaveText("Every setting is at its live value.");

  // Typed words reach the pieces.
  await page.locator(".asset-card", { hasText: "Pick highlight" }).locator("input.asset-text").fill("Rams");
  await expect(page.locator(".asset-highlight")).toContainText("Rams");
  await page.locator(".asset-card", { hasText: "Bowl crest" }).locator("input.asset-text").first().fill("Rose Bowl");
  await expect(page.locator(".asset-card", { hasText: "Bowl crest" })).toContainText("ROSE BOWL");

  // The chip has every team.
  await expect(page.locator(".asset-card", { hasText: "Survivor poker chip" }).locator("select option")).toHaveCount(32);
});
