import { expect, test, type Page } from "@playwright/test";
import { signIn as signInAs } from "./session";
import { BOWL_BY_SCENARIO, bowlResponse, homeResponse } from "./standings-fixtures.mjs";

// How the Standings page treats a display choice (hide the Survivor Table, open or close the Bowl Card) and the Bowl Card's first load. A fake clock
// drives the five-minute refresh; the save request is held by the test so the moments in between can be looked at. No screenshots are compared.
// These replace tests that matched the component's source text.
const SCENARIO = "regular-in";
const MINUTE = 60_000;

type Answer = { status: number; body: object };

async function signIn(page: Page) {
  await signInAs(page, "day");
  await page.setViewportSize({ width: 1280, height: 1000 });
}

/**
 * Opens the Standings page. `home` always answers with the Survivor Table shown (the "stale" profile snapshot a refresh could carry back), the profile
 * save is held until `answer(...)` is called, and `bowl` decides whether the Bowl Card's own request is answered.
 */
async function open(page: Page, options: { bowl?: "answered" | "held"; frozen?: boolean } = {}) {
  const calls = { home: 0, bowl: 0, saves: [] as object[] };
  let answer: (value: Answer) => void = () => undefined;
  const answered = new Promise<Answer>((resolve) => { answer = resolve; });
  await signIn(page);
  const home = homeResponse(SCENARIO);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => { calls.home += 1; return route.fulfill({ json: home }); });
  await page.route("**/api/profile**", async (route) => {
    if (route.request().method() !== "PUT") return route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } });
    calls.saves.push(route.request().postDataJSON());
    const { status, body } = await answered;
    return route.fulfill({ status, json: body });
  });
  await page.route("**/api/bowl-pool**", (route) => { calls.bowl += 1; return options.bowl === "held" ? new Promise(() => undefined) : route.fulfill({ json: bowlResponse((BOWL_BY_SCENARIO as Record<string, Parameters<typeof bowlResponse>[0]>)[SCENARIO]) }); });
  await page.route("**/api/season-snapshot**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(home.serverTime) });
  // A frozen clock stands still until the test moves it, so what the page does "after two seconds" cannot depend on how long the browser took.
  if (options.frozen) await page.clock.pauseAt(new Date(Date.parse(home.serverTime) + 1_000));
  await page.goto("/");
  return { calls, answer };
}

const hide = (page: Page) => page.getByRole("button", { name: "Hide Survivor Table" });
const show = (page: Page) => page.getByRole("button", { name: "Show Survivor Table" });

test("a display choice shows at once, and a refresh that carries the old choice cannot undo it", async ({ page }) => {
  const { calls, answer } = await open(page);
  await expect(hide(page)).toBeVisible({ timeout: 30_000 });
  const loaded = calls.home;
  await hide(page).click();
  // Shown before the save has been answered: the table starts rolling shut at once.
  await expect(show(page)).toBeVisible();
  expect(calls.saves).toEqual([{ showSurvivorStandings: false }]);
  // The five-minute refresh lands while the save is still out, and its answer still says the table is shown.
  await page.clock.runFor(5 * MINUTE + 1_000);
  await expect.poll(() => calls.home).toBeGreaterThan(loaded);
  await expect(show(page)).toBeVisible();
  await expect(hide(page)).toHaveCount(0);
  answer({ status: 200, body: {} });
  await expect(show(page)).toBeVisible();
});

test("a second tap while a choice is being saved is ignored", async ({ page }) => {
  const { calls, answer } = await open(page);
  await hide(page).click();
  await expect(show(page)).toBeVisible();
  await show(page).click({ force: true });
  expect(calls.saves, "one save, not two").toHaveLength(1);
  await expect(show(page)).toBeVisible();
  answer({ status: 200, body: {} });
  await show(page).click();
  await expect.poll(() => calls.saves.length).toBe(2);
  expect(calls.saves[1]).toEqual({ showSurvivorStandings: true });
});

test("a failed save puts the old choice back and says so", async ({ page }) => {
  const { answer } = await open(page);
  await hide(page).click();
  await expect(show(page)).toBeVisible();
  answer({ status: 500, body: { error: "The save failed on the server." } });
  await expect(hide(page)).toBeVisible();
  await expect(page.getByText("The save failed on the server.")).toBeVisible();
});

/** Moves a frozen clock on in 100 ms steps until the page is shown (the loading shell is gone); answers how far it had to move. */
async function advanceUntilShown(page: Page, limitMs: number) {
  let moved = 0;
  while (await page.locator("div[inert] .my-ticket").count() > 0) {
    if (moved >= limitMs) throw new Error(`the page was still behind the loading shell after ${moved} ms`);
    await page.clock.runFor(100);
    moved += 100;
    await page.waitForTimeout(25);
  }
  return moved;
}

test("the Standings page waits for the Bowl Card's first load, with a short time limit", async ({ page }) => {
  const { calls } = await open(page, { bowl: "held", frozen: true });
  // The page is laid out but inert beneath the loading shell, and the Bowl Card has asked but never gets an answer.
  await expect(page.locator("div[inert] .my-ticket")).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => calls.bowl).toBeGreaterThan(0);
  // Nothing reveals it early...
  await page.clock.runFor(2_000);
  await page.waitForTimeout(100);
  await expect(page.locator("div[inert] .my-ticket")).toHaveCount(1);
  // ...but it is shown anyway once the limit (two and a half seconds) has passed.
  const moved = await advanceUntilShown(page, 1_500);
  expect(moved + 2_000, "not before the limit").toBeGreaterThanOrEqual(2_500);
  await expect(page.locator(".my-ticket")).toBeVisible();
});

test("once the Bowl Card has loaded, the Standings page is shown without waiting out the time limit", async ({ page }) => {
  const { calls } = await open(page, { bowl: "answered", frozen: true });
  await expect(page.locator("div[inert] .my-ticket")).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => calls.bowl).toBeGreaterThan(0);
  await page.waitForTimeout(200);
  const moved = await advanceUntilShown(page, 2_400);
  expect(moved, "well inside the limit").toBeLessThan(2_000);
  await expect(page.locator(".my-ticket")).toBeVisible();
});
