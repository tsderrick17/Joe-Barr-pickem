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
      await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 20_000 }).catch(async (error) => {
        console.log("INCOMPLETE", JSON.stringify(await page.evaluate(() => [...document.images].filter((image) => !image.complete).map((image) => ({ src: image.currentSrc || image.src, loading: image.loading })))));
        throw error;
      });
      await page.waitForLoadState("networkidle");
      // The Next.js development badge is not part of the product.
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await expect(page).toHaveScreenshot(`${scenario}-${label}.png`, { fullPage: true });
    });
  }
}
