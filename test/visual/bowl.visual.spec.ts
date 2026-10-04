import { expect, test, type Page } from "@playwright/test";
import { bowlResponse } from "./standings-fixtures.mjs";

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-1280": 1280 } as const;
// Mid-December: the bowl season is under way, and the Pool has launched.
const NOW = "2026-12-12T15:00:00Z";
const SCENARIOS = {
  "not-joined": () => bowlResponse({ optedIn: false, entryOpen: true }),
  "picked": () => bowlResponse({ optedIn: true, entryOpen: true, picks: { "bowl-1": "a1", "bowl-2": "h2", "bowl-3": "h3" } }),
} as const;

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

for (const [scenario, build] of Object.entries(SCENARIOS)) {
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
        await page.clock.install({ time: new Date(NOW) });
        await page.goto("/bowl-pool");
        await expect(page.locator(".bowl-pool-page h2, .bowl-claim h3").first()).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.reload();
        await expect(page.locator(".bowl-pool-page h2, .bowl-claim h3").first()).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.images].every((image) => image.complete));
        await page.waitForLoadState("networkidle");
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await expect(page).toHaveScreenshot(`bowl-${scenario}-${theme}-${label}.png`, { fullPage: true });
      });
    }
  }
}
