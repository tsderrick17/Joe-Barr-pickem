import { expect, test, type Page } from "@playwright/test";
import { homeResponse } from "./standings-fixtures.mjs";
import { boardResponse } from "./slate-fixtures.mjs";

// A first load that fails (iPhone Safari cuts a request off when the tab is backgrounded; a cold start can run long) is tried once more by itself, so a player is
// not shown "taking too long" for a blip; a second failure shows the error, and coming back to the tab loads again at once. No screenshots are compared.
async function signIn(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
  await page.addInitScript((value) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, JSON.stringify(session));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/bowl-pool**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
}

/** Answers /api/home with `failures` network failures first, then the Standings. (A failed read is also retried once inside the session fetch, so one
 *  failed load of the page costs two of these.) */
async function serveHome(page: Page, failures: number) {
  const calls = { home: 0 };
  await page.route("**/api/home**", (route) => {
    calls.home += 1;
    return calls.home <= failures ? route.abort("failed") : route.fulfill({ json: homeResponse("commissioner-playoff") });
  });
  return calls;
}
const tooLong = (page: Page) => page.getByText("The Standings are taking too long to load");

test("a first load that hangs until it times out is tried again by itself, and the player never sees an error", async ({ page }) => {
  await signIn(page);
  const calls = { home: 0 };
  await page.route("**/api/home**", (route) => {
    calls.home += 1;
    return calls.home === 1 ? undefined : route.fulfill({ json: homeResponse("commissioner-playoff") });   // the first request never answers
  });
  await page.clock.install({ time: new Date("2026-10-14T12:00:00Z") });
  await page.goto("/");
  await page.clock.runFor(15_500);   // the fifteen-second wait runs out and the request is dropped
  await page.clock.runFor(2_000);    // and the page asks again
  await expect(page.locator(".my-ticket")).toBeVisible({ timeout: 30_000 });
  await expect(tooLong(page)).toHaveCount(0);
});

test("when the first load and its retry both fail, the error and Try again show, and the page then waits for the player", async ({ page }) => {
  await signIn(page);
  const calls = await serveHome(page, 100);
  await page.goto("/");
  await expect(tooLong(page)).toBeVisible({ timeout: 30_000 });
  const settled = calls.home;
  await page.waitForTimeout(3_000);
  expect(calls.home, "nothing more is sent until the player acts").toBe(settled);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("coming back to the tab loads the Standings again at once while the error is showing", async ({ page }) => {
  await signIn(page);
  const calls = { home: 0, working: false };
  await page.route("**/api/home**", (route) => { calls.home += 1; return calls.working ? route.fulfill({ json: homeResponse("commissioner-playoff") }) : route.abort("failed"); });
  await page.goto("/");
  await expect(tooLong(page)).toBeVisible({ timeout: 30_000 });
  calls.working = true;
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".my-ticket")).toBeVisible({ timeout: 30_000 });
  await expect(tooLong(page)).toHaveCount(0);
});

test("a Slate load that hangs is dropped after fifteen seconds and tried again by itself", async ({ page }) => {
  await signIn(page);
  const calls = { board: 0 };
  await page.route("**/api/board**", (route) => {
    calls.board += 1;
    return calls.board === 1 ? undefined : route.fulfill({ json: boardResponse("upcoming-unpicked") });   // the first request never answers
  });
  await page.goto("/board");
  await expect(page.locator("[aria-label='Your weekly receipt']")).toBeVisible({ timeout: 40_000 });   // the real fifteen-second wait, then the retry
  await expect(page.getByText("The Slate is taking too long to load")).toHaveCount(0);
});
