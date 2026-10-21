import { expect, test, type Page } from "@playwright/test";
import { commissionerApi, NOW as ADMIN_NOW } from "./commissioner-fixtures.mjs";
import { homeResponse } from "./standings-fixtures.mjs";

// How often the player pages ask the server again. Each refresh costs Vercel CPU, so the cadence is pinned by behavior: the page asks again every
// five minutes (the chat every three), never while the tab is hidden, and once when the player comes back after a while. A fake clock drives the
// timers; no screenshots are compared. These replace tests that matched the intervals in the component source.
const SCENARIO = "commissioner-playoff";
const MINUTE = 60_000;

async function signIn(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
  await page.addInitScript((value) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, JSON.stringify(session));
  await page.setViewportSize({ width: 1280, height: 1000 });
}

async function open(page: Page) {
  const calls = { home: 0, chat: 0 };
  await signIn(page);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => { calls.home += 1; return route.fulfill({ json: homeResponse(SCENARIO) }); });
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: true } }));
  await page.route("**/api/pool-chat**", (route) => { calls.chat += 1; return route.fulfill({ json: { messages: [] } }); });
  await page.route("**/api/bowl-pool**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date("2026-10-14T12:00:00Z") });
  await page.goto("/");
  await expect(page.locator(".my-ticket")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => calls.chat, { timeout: 30_000 }).toBeGreaterThan(0);
  return calls;
}

/** Makes the tab look hidden or visible to the page, and tells it so. */
const setVisibility = (page: Page, state: "hidden" | "visible") => page.evaluate((next) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => next });
  document.dispatchEvent(new Event("visibilitychange"));
}, state);

test("the home page asks again every five minutes, not while the tab is hidden, and once on return", async ({ page }) => {
  const calls = await open(page);
  const loaded = calls.home;
  await page.clock.runFor(4 * MINUTE);
  expect(calls.home, "nothing in the first four minutes").toBe(loaded);
  await page.clock.runFor(MINUTE + 1_000);
  await expect.poll(() => calls.home).toBe(loaded + 1);
  await setVisibility(page, "hidden");
  await page.clock.runFor(12 * MINUTE);
  expect(calls.home, "a hidden tab never asks").toBe(loaded + 1);
  await setVisibility(page, "visible");
  await expect.poll(() => calls.home, { message: "coming back after a while refreshes once" }).toBe(loaded + 2);
  await setVisibility(page, "hidden");
  await setVisibility(page, "visible");
  await page.clock.runFor(1_000);
  expect(calls.home, "coming back again within thirty seconds does not ask again").toBe(loaded + 2);
});

test("the pool chat asks again every three minutes and never while the tab is hidden", async ({ page }) => {
  const calls = await open(page);
  const loaded = calls.chat;
  await page.clock.runFor(2 * MINUTE);
  expect(calls.chat, "nothing in the first two minutes").toBe(loaded);
  await page.clock.runFor(MINUTE + 1_000);
  await expect.poll(() => calls.chat).toBe(loaded + 1);
  await setVisibility(page, "hidden");
  await page.clock.runFor(10 * MINUTE);
  expect(calls.chat, "a hidden tab never asks").toBe(loaded + 1);
});

/** The Commissioner's Grading dashboard (the default panel of /admin) in the given fixture state; counts how often it asks the server. */
async function openGrading(page: Page, state: "healthy" | "quiet") {
  const calls = { grading: 0 };
  const api = commissionerApi(state) as Record<string, unknown>;
  await signIn(page);
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\//, "");
    if (route.request().method() !== "GET") return route.fulfill({ status: 204, body: "" });
    if (path === "profile") return route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } });
    if (path === "admin/grading-dashboard") calls.grading += 1;
    if (path in api) return route.fulfill({ json: api[path] });
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(ADMIN_NOW) });
  await page.goto("/admin");
  await expect.poll(() => calls.grading, { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(page.locator("option[value=p5]").first()).toBeAttached({ timeout: 30_000 });   // the dashboard has its data, so its polling timer is set
  return calls;
}

test("the grading dashboard asks every minute while games are live, and returns immediately when the tab comes back", async ({ page }) => {
  const calls = await openGrading(page, "healthy");
  const loaded = calls.grading;
  await page.clock.runFor(55_000);
  expect(calls.grading, "not before the minute").toBe(loaded);
  await page.clock.runFor(10_000);
  await expect.poll(() => calls.grading).toBe(loaded + 1);
  await setVisibility(page, "hidden");
  await page.clock.runFor(5 * MINUTE);
  expect(calls.grading, "a hidden tab never asks").toBe(loaded + 1);
  await setVisibility(page, "visible");
  await expect.poll(() => calls.grading).toBe(loaded + 2);
});

test("the grading dashboard asks only every fifteen minutes when nothing is live", async ({ page }) => {
  const calls = await openGrading(page, "quiet");
  const loaded = calls.grading;
  await page.clock.runFor(14 * MINUTE);
  expect(calls.grading, "nothing in the first fourteen minutes").toBe(loaded);
  await page.clock.runFor(MINUTE + 5_000);
  await expect.poll(() => calls.grading).toBe(loaded + 1);
});
