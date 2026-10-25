import { expect, test, type Page } from "@playwright/test";
import { BOWL_BY_SCENARIO, bowlResponse, homeResponse } from "./standings-fixtures.mjs";

// The Survivor Table and the Bowl Card scroll sideways on a phone, and an iPhone lets them be pulled past their edge. What shows in that gap is whatever
// is the scroller's own background, so it must be the page's colour. No screenshots are compared.
const SCENARIO = "bowl-results";

async function open(page: Page, theme: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await page.addInitScript(([value, mode]) => { window.localStorage.setItem("sb-placeholder-auth-token", value as string); window.localStorage.setItem("pickem-theme", mode as string); }, [JSON.stringify(session), theme]);
  await page.setViewportSize({ width: 390, height: 900 });
  const home = homeResponse(SCENARIO);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: home }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("**/api/bowl-pool**", (route) => route.fulfill({ json: bowlResponse((BOWL_BY_SCENARIO as Record<string, Parameters<typeof bowlResponse>[0]>)[SCENARIO]) }));
  await page.route("**/api/season-snapshot**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(home.serverTime) });
  await page.goto("/");
}

for (const theme of ["day", "night"]) {
  test(`the Survivor Table and Bowl Card are the page colour behind their rows, so a sideways pull shows the page (${theme})`, async ({ page }) => {
    await open(page, theme);
    for (const selector of [".survivor-standings-scroll", ".bowl-standings-scroll"]) {
      const scroller = page.locator(selector).first();
      await expect(scroller, selector).toBeVisible({ timeout: 30_000 });
      // It really is a sideways scroller here, so there is an edge to pull past.
      expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth), `${selector} scrolls sideways at phone width`).toBe(true);
      const paint = await scroller.evaluate((element) => ({ colour: getComputedStyle(element).backgroundColor, image: getComputedStyle(element).backgroundImage, page: getComputedStyle(document.body).backgroundColor }));
      expect(paint.page, "the page has a colour of its own").not.toBe("rgba(0, 0, 0, 0)");
      expect(paint, `${selector} is the page's colour, so nothing paler shows past its edge`).toEqual({ colour: paint.page, image: "none", page: paint.page });
    }
  });
}
