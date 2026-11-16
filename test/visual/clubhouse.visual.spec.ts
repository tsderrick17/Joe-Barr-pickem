import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
import { homeResponse } from "./standings-fixtures.mjs";
import { boardResponse } from "./slate-fixtures.mjs";

const SIZES = { "phone-390": { width: 390, height: 844 }, "desktop-1280": { width: 1280, height: 800 } } as const;

/** The real clubhouse at /clubhouse: the Standings' and the Slate's own reads, served from their fixtures. */
const sent: unknown[] = [];
async function openClubhouse(page: Page, { theme = "day", size = SIZES["phone-390"] as { width: number; height: number }, commissioner = true, scenarios = ["upcoming-picked"], at = "/clubhouse" } = {}) {
  sent.length = 0;
  await page.setViewportSize(size);
  await signIn(page, theme);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The Slate's read, one scenario per read (the last one repeats): a pick made on the Slate shows on the second read.
  const board = boardResponse(scenarios[0]);
  let reads = 0;
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: homeResponse("regular-in") }));
  // Like the real route, the Slate's read refuses without a week (bootstrap=1 asks for the default one).
  await page.route("**/api/board**", (route) => (new URL(route.request().url()).searchParams.get("bootstrap") === "1" ? route.fulfill({ json: boardResponse(scenarios[Math.min(reads++, scenarios.length - 1)]) }) : route.fulfill({ status: 400, json: { error: "You must choose a week before viewing the board." } })));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: commissioner, showPoolChat: false } }));
  await page.route("**/api/trophy-room**", (route) => route.fulfill({ json: { trophies: [{ seasonYear: 2025, pickem: [{ playerId: "p0", name: "Gary" }], survivor: [{ playerId: "p1", name: "Connor" }], bowl: null }], players: [{ playerId: "p0", name: "Gary", ab: 40, h: 24, avg: 0.6, qualified: true, halfWins: 1, halfLosses: 0, pushes: 0, streaks: null }] } }));
  // A sent pick: every POST is kept so a test can read exactly what the real route would have been asked to save.
  await page.route("**/api/picks", async (route) => { sent.push(route.request().postDataJSON()); await route.fulfill({ json: { message: "saved" } }); });
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(board.serverTime) });
  await page.goto(at);
}

for (const [label, size] of Object.entries(SIZES)) {
  for (const theme of label === "phone-390" ? ["day", "night"] : ["day"]) {
    test(`the clubhouse fills the screen with the room, the real boards in it, at ${label} by ${theme}`, async ({ page }) => {
      await openClubhouse(page, { theme, size });
      const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
      await expect(room).toBeVisible({ timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      // The room covers the whole screen under the site's bar: as wide as the screen at least, and as tall as what is left.
      const stage = (await page.locator(".lab-room-stage").boundingBox())!;
      expect(stage.width).toBe(size.width);
      expect(Math.abs(stage.y + stage.height - size.height)).toBeLessThanOrEqual(1);
      const above = await page.locator("main").evaluate((main) => main.previousElementSibling?.getBoundingClientRect().bottom ?? 0);
      expect(stage.y).toBeGreaterThanOrEqual(above - 1);
      // Every name plate is on screen.
      const plates = await room.locator(".lab-room-tag").evaluateAll((tags) => tags.map((tag) => ({ box: tag.getBoundingClientRect(), text: tag.textContent })).map(({ box, text }) => ({ text, left: box.left, right: box.right })));
      for (const plate of plates) { expect(plate.left).toBeGreaterThanOrEqual(0); expect(plate.right).toBeLessThanOrEqual(size.width); }
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`clubhouse-room-${theme}-${label}.png`, { maxDiffPixels: 40 });
    });
  }
}

test("every thing in the room opens its pop-up over it, on the real week, and the way back is always there", async ({ page }) => {
  await openClubhouse(page);
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(room).toBeVisible({ timeout: 30_000 });
  // The room is one screen: the page does not scroll, and no chat sits under it.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
  await expect(page.locator(".pool-chat-dock")).toHaveCount(0);
  // No sample players: the boards show the fixture's league and week.
  await expect(page.locator(".lab-room-screen.is-board header")).not.toContainText("WEEK 10");
  await expect(page.locator(".lab-ticker p").first()).toBeVisible();
  await expect(page.getByText("You must choose a week")).toHaveCount(0);
  const opens = async (button: string, pane: string, inside: RegExp | string) => {
    await room.getByRole("button", { name: button, exact: true }).click();
    const popup = page.getByRole("dialog", { name: pane });
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(inside, { timeout: 30_000 });
    await popup.getByRole("button", { name: "Close", exact: true }).click();
    await expect(popup).toHaveCount(0);
    await expect(page).toHaveURL(/\/clubhouse$/);
  };
  await opens("The Big Board", "The Big Board", /GARY/);
  await opens("Survivor", "Survivor", /Survivor Table/);
  await opens("Trophy Room", "Trophy Room", /Plaques/);
  await opens("Constitution", "Constitution", /Constitution/);
  // Your picks, and the ticket in the room, open the same board with your ticket ready.
  await room.getByRole("button", { name: "Your picks", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Your ticket" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /YOUR TICKET/ }).click();
  await expect(page.getByRole("dialog", { name: "Your ticket" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await room.getByRole("button", { name: "Pool chat", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Pool chat" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Pool chat" })).toBeHidden();
});

test("the open pop-up has its own address: back closes it, a reload reopens it, a link to another page opens that pop-up in place", async ({ page }) => {
  await openClubhouse(page);
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(room).toBeVisible({ timeout: 30_000 });
  await room.getByRole("button", { name: "The Big Board", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "The Big Board" })).toBeVisible();
  await expect(page).toHaveURL(/\/clubhouse#standings$/);
  await page.goBack();   // the phone's back gesture
  await expect(page).toHaveURL(/\/clubhouse$/);
  await expect(page.getByRole("dialog", { name: "The Big Board" })).toHaveCount(0);
  await expect(room).toBeVisible();
  // The header's link to the Slate opens the board with your ticket ready, in place; the Survivor table opens from the board and goes back to the room in one step.
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "The Slate" }).click();
  await expect(page.getByRole("dialog", { name: "Your ticket" })).toBeVisible();
  await expect(page).toHaveURL(/\/clubhouse#slate$/);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await room.getByRole("button", { name: "The Big Board", exact: true }).click();
  await page.getByRole("button", { name: /Survivor table/ }).click();
  await expect(page.getByRole("dialog", { name: "Survivor" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "The Big Board" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/clubhouse#survivor$/);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // A pop-up can be linked to and reloaded.
  await page.goto("/clubhouse#slate");
  await expect(page.getByRole("dialog", { name: "Your ticket" })).toBeVisible({ timeout: 30_000 });
});

test("a pick sent from the ticket is the real pick: the same POST the Slate makes, and the room's ticket shows it at once", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["upcoming-unpicked", "upcoming-picked"] });
  const ticket = page.getByRole("button", { name: /YOUR TICKET/ });
  await expect(ticket).toContainText("0 of", { timeout: 30_000 });
  await ticket.click();
  const form = page.getByRole("dialog", { name: "Your ticket" });
  await expect(form).toBeVisible();
  await expect(form.getByRole("button", { name: /Submit picks/ })).toBeDisabled();   // nothing picked yet
  const cells = form.locator(".lab-window-part .lab-board-cell:not([disabled])");
  await cells.nth(0).click();
  await cells.nth(2).click();
  await form.getByRole("button", { name: /Submit picks/ }).click();
  await expect(form).toHaveCount(0);   // the ticket closes; the board under it stays and shows the pick
  expect(sent).toHaveLength(1);
  await expect(page.getByRole("dialog", { name: "The Big Board" }).getByRole("button", { name: /Pick 1: .* Open your ticket/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const body = sent[0] as { scoringPeriodId: string; selections: Array<{ gameId: string; teamId: string }> };
  expect(body.scoringPeriodId).toBe("week-5");
  expect(body.selections).toHaveLength(2);
  expect(body.selections.every((pick) => pick.gameId && pick.teamId)).toBe(true);
  await expect(page.getByRole("button", { name: /YOUR TICKET/ })).not.toContainText("0 of");
});

test("a pick the server refuses says so on the ticket and stays open", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["upcoming-unpicked"] });
  await page.route("**/api/picks", (route) => route.fulfill({ status: 409, json: { error: "That game has already kicked off." } }));
  await page.getByRole("button", { name: /YOUR TICKET/ }).click();
  const form = page.getByRole("dialog", { name: "Your ticket" });
  await form.locator(".lab-window-part .lab-board-cell:not([disabled])").nth(0).click();
  await form.getByRole("button", { name: /Submit picks/ }).click();
  await expect(form.getByRole("alert")).toContainText("already kicked off");
  await expect(form).toBeVisible();
});

test("the switch is a mode: up, opening the app lands in the clubhouse; down, it does not", async ({ page }) => {
  await openClubhouse(page, { at: "/board" });
  const nav = page.getByRole("navigation", { name: "Account navigation" });
  await nav.getByRole("link", { name: "Clubhouse view" }).click();
  await expect(page).toHaveURL(/\/clubhouse$/, { timeout: 30_000 });
  await page.goto("/");   // the app's front door
  await expect(page).toHaveURL(/\/clubhouse$/, { timeout: 30_000 });
  await nav.getByRole("link", { name: "Classic view" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Standings", level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/$/);
});

test("a player who is not the Commissioner is sent to the Standings and has no switch", async ({ page }) => {
  await openClubhouse(page, { commissioner: false });
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Clubhouse view|Classic view/ })).toHaveCount(0);
});
