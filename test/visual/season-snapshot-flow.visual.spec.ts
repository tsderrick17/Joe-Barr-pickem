import { expect, test, type Page } from "@playwright/test";
import { homeResponse, seasonSnapshotResponse } from "./standings-fixtures.mjs";

// Behavior of the Season Snapshot (the back of the Pick'em Pad), driven in a real browser against fixtures.
// These replace tests that matched the component's source text; no screenshots are compared here.

const SCENARIO = "commissioner-playoff";

async function signIn(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
  await page.addInitScript((value) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, JSON.stringify(session));
}

/** The fixture snapshot, stretched to nine regular weeks so the six-week window has something to scroll. */
function nineWeekSnapshot() {
  const base = seasonSnapshotResponse(SCENARIO);
  const template = base.regular[base.regular.length - 1];
  const regular = Array.from({ length: 9 }, (_, week) => ({
    id: `week-${week + 1}`, label: `Week ${week + 1}`, complete: true,
    scores: template.scores.map((score: { playerId: string; wins: number }, index: number) => ({ playerId: score.playerId, wins: Math.max(0, Math.round((week + 1) * (1.8 - index * 0.12))) })),
  }));
  return { ...base, regular };
}

async function open(page: Page) {
  const requests = { snapshot: 0 };
  const home = homeResponse(SCENARIO);
  await signIn(page);
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: home }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/bowl-pool**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/season-snapshot**", (route) => { requests.snapshot += 1; return route.fulfill({ json: nineWeekSnapshot() }); });
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".my-ticket")).toBeVisible({ timeout: 30_000 });
  return requests;
}

const flipButton = (page: Page) => page.getByRole("button", { name: "Show the Season Snapshot" });
const backButton = (page: Page) => page.getByRole("button", { name: "Show the Pick'em Pad" });
const keyRows = (page: Page) => page.locator(".season-snapshot-key-row");
const ribbonFills = (page: Page) => page.evaluate(() => [...document.querySelectorAll(".season-snapshot-ribbon > path:first-child")].map((path) => path.getAttribute("fill")));
const axisTicks = (page: Page) => page.evaluate(() => [...document.querySelectorAll(".season-snapshot-yaxis text:not(.season-snapshot-axis-label)")].map((text) => text.textContent));

test("the snapshot loads only when the pad is turned over, and only once", async ({ page }) => {
  const requests = await open(page);
  expect(requests.snapshot).toBe(0);
  await flipButton(page).click();
  await expect(page.locator(".season-snapshot-chart")).toBeVisible();
  expect(requests.snapshot).toBe(1);
  await backButton(page).click();
  await flipButton(page).click();
  await expect(page.locator(".season-snapshot-chart")).toBeVisible();
  expect(requests.snapshot, "turning the pad back and forth costs no more requests").toBe(1);
});

test("once the playoffs begin there is a Season | Playoffs switch, and the week range belongs to Season only", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  const half = page.getByRole("group", { name: "Season half shown" });
  await expect(half.getByRole("button", { name: "Playoffs" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Weeks shown" })).toHaveCount(0);
  await half.getByRole("button", { name: "Season" }).click();
  await expect(half.getByRole("button", { name: "Season" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Weeks shown" })).toBeVisible();
});

test("6 Wk windows the chart to six weeks that scroll; All fits the whole season", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  const plot = page.locator(".season-snapshot-plot-scroll");
  await expect(plot).not.toHaveClass(/is-windowed/);
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
  await expect(plot).toHaveClass(/is-windowed/);
  // Nine weeks in a six-week window: the track is wider than what is visible, and it opens on the latest weeks.
  const sizes = await plot.evaluate((element) => ({ visible: element.clientWidth, track: element.scrollWidth, left: element.scrollLeft }));
  expect(sizes.track).toBeGreaterThan(sizes.visible);
  expect(sizes.left).toBeGreaterThan(0);
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "All" }).click();
  await expect(plot).not.toHaveClass(/is-windowed/);
});

test("hiding a player removes their line and rescales the axis; nobody's color moves; Show all restores", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await expect(keyRows(page).first()).toBeVisible();
  // The key shows the chart's own totals: the leader's last plotted week, not a separate tally.
  await expect(keyRows(page).first().locator("strong")).toHaveText("16");
  const count = await keyRows(page).count();
  const swatchOf = (index: number) => keyRows(page).nth(index).locator(".season-snapshot-swatch").evaluate((element) => getComputedStyle(element).backgroundColor);
  const colorsBefore = await Promise.all(Array.from({ length: count }, (_, index) => swatchOf(index)));
  expect(new Set(colorsBefore).size, "every player has a distinct color").toBe(count);
  const fillsBefore = await ribbonFills(page);
  const ticksBefore = await axisTicks(page);
  const leader = keyRows(page).first();
  await leader.click();
  await expect(leader).toHaveAttribute("aria-pressed", "false");
  const fillsAfter = await ribbonFills(page);
  expect(fillsAfter.length).toBeLessThan(fillsBefore.length);
  expect(await axisTicks(page), "the axis rescales to whoever remains").not.toEqual(ticksBefore);
  // Everyone still on the chart keeps the color they had.
  const colorsAfter = await Promise.all(Array.from({ length: count }, (_, index) => swatchOf(index)));
  expect(colorsAfter).toEqual(colorsBefore);
  const showAll = page.getByRole("button", { name: "Show all" });
  await expect(showAll).toBeEnabled();
  await showAll.click();
  await expect(showAll).toBeDisabled();
  expect(await ribbonFills(page)).toEqual(fillsBefore);
});

test("chart choices are remembered on this device", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
  await keyRows(page).first().click();
  await page.reload();
  await expect(page.locator(".my-ticket")).toBeVisible({ timeout: 30_000 });
  await flipButton(page).click();
  await expect(page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" })).toHaveAttribute("aria-pressed", "true");
  await expect(keyRows(page).first()).toHaveAttribute("aria-pressed", "false");
});
