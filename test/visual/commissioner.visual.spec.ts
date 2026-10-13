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
  { id: "overview", tab: 0, states: ["healthy", "attention", "quiet"] },
  { id: "grading", tab: 1, states: ["healthy", "attention", "quiet"], open: ["Activity log"] },
  { id: "game-day", tab: 2, states: ["healthy"], open: ["Automation checks and manual runs"] },
  { id: "bowl-pool", tab: 3, states: ["healthy", "attention"] },
  { id: "season-setup", tab: 4, states: ["healthy"] },
  { id: "system", tab: 5, states: ["healthy", "attention"], open: ["Automation health and alerts"] },
  { id: "assets", tab: 6, states: ["healthy"] },
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
          await page.waitForTimeout(600);
          await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
          await page.waitForFunction(() => [...document.images].every((image) => image.complete));
          await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
          await page.waitForLoadState("networkidle");
          // The loading football is stepped by script, which a screenshot cannot pause: hold it on its first frame.
          if (panel.id === "assets") await page.addStyleTag({ content: ".football-loader-ball { background-position: 0 0 !important; }" });
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

// Commissioners (a trial before players) get Add to Home Screen in their name menu; without Chrome's install dialog it shows the steps.
for (const [label, userAgent] of [["iphone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"], ["other", undefined]] as const) {
  test(`Commissioner Add to Home Screen steps on ${label}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 700 }, ...(userAgent ? { userAgent } : {}) });
    const page = await context.newPage();
    // Hold back Chrome's own install dialog so the steps are shown the same everywhere.
    await page.addInitScript(() => window.addEventListener("beforeinstallprompt", (event) => event.stopImmediatePropagation()));
    await signIn(page, "day");
    await serve(page, "healthy");
    await settle(page, ".commissioner-panel-tab");
    await page.locator(".account-menu-button:visible").click();
    await page.getByRole("menuitem", { name: "Add to Home Screen" }).click();
    await expect(page.getByRole("menuitem", { name: "Done" })).toBeVisible();
    await expect(page.locator(".account-menu-panel")).toHaveScreenshot(`commissioner-add-to-home-screen-${label}.png`);
    await page.getByRole("menuitem", { name: "Done" }).click();
    await expect(page.locator(".account-menu-panel")).toHaveCount(0);
    await context.close();
  });
}
