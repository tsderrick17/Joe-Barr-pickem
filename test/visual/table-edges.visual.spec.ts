import { expect, test, type Page } from "@playwright/test";
import { BOWL_BY_SCENARIO, bowlResponse, homeResponse } from "./standings-fixtures.mjs";

// The Survivor Table and the Bowl Card scroll sideways on a phone, and an iPhone lets them be pulled past their edge. What shows in that gap is whatever
// is the scroller's own background, so it must be the colour of whatever is behind it: the page's main area (not `body`, which sits under it in another colour). No
// screenshots are compared.
const SCENARIO = "bowl-results";

async function open(page: Page, theme: string, options: { width?: number; gameName?: string } = {}) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await page.addInitScript(([value, mode]) => { window.localStorage.setItem("sb-placeholder-auth-token", value as string); window.localStorage.setItem("pickem-theme", mode as string); }, [JSON.stringify(session), theme]);
  await page.setViewportSize({ width: options.width ?? 390, height: 900 });
  const home = homeResponse(SCENARIO);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: home }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("**/api/bowl-pool**", (route) => {
    const body = bowlResponse((BOWL_BY_SCENARIO as Record<string, Parameters<typeof bowlResponse>[0]>)[SCENARIO]);
    if (options.gameName) for (const game of body.games) game.bowl_name = options.gameName;
    return route.fulfill({ json: body });
  });
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
      const paint = await scroller.evaluate((element) => {
        // What shows past the scroller's edge: the first colour found walking up from it.
        let behind = element.parentElement;
        while (behind && getComputedStyle(behind).backgroundColor === "rgba(0, 0, 0, 0)") behind = behind.parentElement;
        return { colour: getComputedStyle(element).backgroundColor, image: getComputedStyle(element).backgroundImage, behind: behind ? getComputedStyle(behind).backgroundColor : "none found" };
      });
      expect(paint.behind, "something behind the scroller has a colour").not.toBe("none found");
      expect(paint, `${selector} is the colour behind it, so nothing paler shows past its edge`).toEqual({ colour: paint.behind, image: "none", behind: paint.behind });
    }
  });
}

// On a touch screen the scroll indicator floats over the table's bottom edge and the frozen name cells cover it, so the last row needs clear space beneath it.
// A mouse's scrollbar takes its own room already, so the space is only added on touch (and the desktop and phone-width screenshots, taken with a mouse, are unchanged).
test.describe("touch screen", () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const theme of ["day", "night"]) {
    test(`the Survivor Table and Bowl Card leave room under the last row for the scroll indicator (${theme})`, async ({ page }) => {
      await open(page, theme);
      for (const selector of [".survivor-standings-scroll", ".bowl-standings-scroll"]) {
        const scroller = page.locator(selector).first();
        await expect(scroller, selector).toBeVisible({ timeout: 30_000 });
        const room = await scroller.evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
        expect(room, `${selector} has clear space under its last row`).toBeGreaterThanOrEqual(8);
      }
    });
  }
});

test("with a mouse the tables add no extra space under the last row", async ({ page }) => {
  await open(page, "day");
  for (const selector of [".survivor-standings-scroll", ".bowl-standings-scroll"]) {
    const scroller = page.locator(selector).first();
    await expect(scroller, selector).toBeVisible({ timeout: 30_000 });
    expect(await scroller.evaluate((element) => getComputedStyle(element).paddingBottom), selector).toBe("0px");
  }
});

// The Bowl Card's game headings are in a narrow column (the column is 116px on a phone, 120px on a tablet, less its padding), and "Championship" is wider than
// that. The word must spill into the cell's own padding, not stretch the column or run under the next one, where it was cut off ("CHAMPIONSHIF").
for (const width of [360, 390, 700]) {
  test(`a long game name such as National Championship stays inside its Bowl Card column at ${width}px`, async ({ page }) => {
    await open(page, "day", { gameName: "National Championship", width });
    const headings = page.locator(".bowl-card-section .bowl-standings-bowl-name");
    await expect(headings.first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const fit = await headings.evaluateAll((elements) => elements.map((heading) => {
      const cell = heading.parentElement!.getBoundingClientRect();
      const text = document.createRange();
      text.selectNodeContents(heading);
      const ink = text.getBoundingClientRect();
      const box = heading.getBoundingClientRect();
      // The cell's own left border is not room for text.
      return { cellLeft: cell.left + 1, cellRight: cell.right, inkLeft: ink.left, inkRight: ink.right, boxRight: box.right };
    }));
    expect(fit.length, "every game has a heading").toBeGreaterThan(1);
    for (const [index, item] of fit.entries()) {
      expect(item.boxRight, `heading ${index} does not stretch past its cell`).toBeLessThanOrEqual(item.cellRight + 0.5);
      expect(item.inkLeft, `the name in column ${index} starts inside its cell`).toBeGreaterThanOrEqual(item.cellLeft - 0.5);
      expect(item.inkRight, `the name in column ${index} ends inside its cell`).toBeLessThanOrEqual(item.cellRight + 0.5);
    }
  });
}
