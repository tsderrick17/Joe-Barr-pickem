import { expect, test, type Page } from "@playwright/test";
import { BOWL_BY_SCENARIO, bowlResponse, homeResponse, SCENARIOS, seasonSnapshotResponse } from "./standings-fixtures.mjs";

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-1280": 1280 } as const;
// Night mode is checked on the states that exercise the most styles.
const NIGHT = new Set(["regular-in", "playoff-wildcard", "commissioner", "bowl-results", "bowl-claim-open"]);

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

async function serve(page: Page, scenario: string) {
  const home = homeResponse(scenario);
  // Registered first so the specific routes below win: nothing under /api reaches a server.
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: home }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: home.isCommissioner, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/bowl-pool**", (route) => route.fulfill({ json: bowlResponse(BOWL_BY_SCENARIO[scenario]) }));
  await page.route("**/api/season-snapshot**", (route) => route.fulfill({ json: seasonSnapshotResponse() }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(home.serverTime) });
}

async function settle(page: Page) {
  await page.goto("/");
  await expect(page.locator(".my-ticket").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.reload();
  await expect(page.locator(".my-ticket").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 30)); }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.waitForLoadState("networkidle");
  // The Bowl Card's score tiles spin when the card first comes into view; wait for them to land.
  await page.waitForFunction(() => [...document.querySelectorAll(".bowl-score-tile")].every((tile) => tile.getAttribute("data-settled") === "true"), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

for (const scenario of Object.keys(SCENARIOS)) {
  for (const theme of ["day", "night"]) {
    if (theme === "night" && !NIGHT.has(scenario)) continue;
    for (const [label, width] of Object.entries(WIDTHS)) {
      test(`Standings ${scenario} ${theme} at ${label}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await signIn(page, theme);
        await serve(page, scenario);
        await settle(page);
        await expect(page).toHaveScreenshot(`standings-${scenario}-${theme}-${label}.png`, { fullPage: true });
        if (scenario === "commissioner") {
          // The back of the pad: the Season Snapshot.
          await page.getByRole("button", { name: "Show the Season Snapshot" }).click();
          await page.waitForTimeout(1200);
          await expect(page).toHaveScreenshot(`standings-${scenario}-${theme}-flipped-${label}.png`, { fullPage: true });
        }
      });
    }
  }
}
