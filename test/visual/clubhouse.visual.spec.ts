import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
import { homeResponse } from "./standings-fixtures.mjs";
import { boardResponse } from "./slate-fixtures.mjs";

const SIZES = { "phone-390": { width: 390, height: 844 }, "desktop-1280": { width: 1280, height: 800 } } as const;

type BoardRead = ReturnType<typeof boardResponse>;

/** Each player's wins added up through the week looked back on (the fixture's players p0 to p7): not the same as that week's own wins. */
const WEEK_TOTALS = { p0: 21, p1: 18, p2: 15, p3: 12, p4: 9, p5: 6, p6: 3, p7: 0 };

/** The real clubhouse at /clubhouse: the Standings' and the Slate's own reads, served from their fixtures. */
const sent: unknown[] = [];
async function openClubhouse(page: Page, { theme = "day", size = SIZES["phone-390"] as { width: number; height: number }, commissioner = true, scenarios = ["upcoming-picked"], at = "/clubhouse", homeExtra = {} as Record<string, unknown>, shapeBoard = (response: BoardRead) => response, bowl = null as Record<string, unknown> | null } = {}) {
  sent.length = 0;
  await page.setViewportSize(size);
  await signIn(page, theme);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The Slate's read, one scenario per read (the last one repeats): a pick made on the Slate shows on the second read.
  const board = boardResponse(scenarios[0]);
  let reads = 0;
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: { ...homeResponse("regular-in"), ...homeExtra } }));
  // Like the real route, the Slate's read refuses without a week (bootstrap=1 asks for the default one).
  await page.route("**/api/board**", (route) => (new URL(route.request().url()).searchParams.get("bootstrap") === "1" ? route.fulfill({ json: shapeBoard(boardResponse(scenarios[Math.min(reads++, scenarios.length - 1)])) }) : route.fulfill({ status: 400, json: { error: "You must choose a week before viewing the board." } })));
  await page.route("**/api/board-totals**", (route) => route.fulfill({ json: { weekId: new URL(route.request().url()).searchParams.get("week"), totals: WEEK_TOTALS } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: commissioner, showPoolChat: false } }));
  await page.route("**/api/trophy-room**", (route) => route.fulfill({ json: { trophies: [{ seasonYear: 2025, pickem: [{ playerId: "p0", name: "Gary" }], survivor: [{ playerId: "p1", name: "Connor" }], bowl: null }], players: [{ playerId: "p0", name: "Gary", ab: 40, h: 24, avg: 0.6, qualified: true, halfWins: 1, halfLosses: 0, pushes: 0, streaks: null }] } }));
  // A sent pick: every POST is kept so a test can read exactly what the real route would have been asked to save.
  await page.route("**/api/picks", async (route) => { sent.push(route.request().postDataJSON()); await route.fulfill({ json: { message: "saved" } }); });
  // The Bowl Pool's read, and every POST to it kept like a sent pick.
  if (bowl) await page.route("**/api/bowl-pool", async (route) => { if (route.request().method() === "POST") { sent.push(route.request().postDataJSON()); await route.fulfill({ json: { optedIn: true, saved: 1 } }); } else await route.fulfill({ json: bowl }); });
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
  await opens("Survivor", "Survivor", /GARY/);
  await opens("Trophy Room", "Trophy Room", /Plaques/);
  await opens("Constitution", "Constitution", /Constitution/);
  // The games board in the room opens the same board with your ticket ready.
  await room.getByRole("button", { name: "Make your picks", exact: true }).click();
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
  // The second bar of tabs under the header has no place in the clubhouse. The games board opens the board with your ticket ready, in place;
  // the Survivor table opens from the board and goes back to the room in one step.
  await expect(page.locator(".mobile-primary-nav")).toBeHidden();
  await room.getByRole("button", { name: "Make your picks", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Your ticket" })).toBeVisible();
  await expect(page).toHaveURL(/\/clubhouse#slate$/);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await room.getByRole("button", { name: "The Big Board", exact: true }).click();
  const tabs = page.getByRole("dialog", { name: "The Big Board" }).locator(".lab-tote-links");
  await expect(tabs.locator("[aria-current=page]")).toHaveText("Big Board");
  await tabs.getByRole("button", { name: /^Survivor/ }).click();
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

test("a finished game on the ticket shows each side's final score and who covered, and there is no lock over the line", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["live-mixed-locks-survivor"], at: "/clubhouse#slate" });
  const form = page.getByRole("dialog", { name: "Your ticket" });
  await expect(form).toBeVisible({ timeout: 30_000 });
  const first = form.locator("ol > li").first();
  await expect(first.locator(".lab-board-final").first()).toContainText("17");
  // Under each side's score are the players who took that team, not the margin; the gold still says which side covered.
  await expect(first.locator(".lab-board-final.is-covered")).toContainText("TYLER · CHRIS");
  await expect(first.locator(".lab-board-final:not(.is-covered)")).toContainText("MIKE · PAT");
  await expect(first).not.toContainText("COVERED BY");
  await expect(form.locator(".lab-board-lock")).toHaveCount(0);
  // A game that has kicked off but is not final shows no score.
  await expect(form.locator("ol > li").nth(2).locator(".lab-board-final")).toHaveCount(0);
});

test("once Survivor is decided the poker table is the Bowl Pool's, in its own colors, and the Big Board still links to Survivor", async ({ page }) => {
  await openClubhouse(page, { homeExtra: { survivorComplete: true, survivorChampionName: "Walt" } });
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(room).toBeVisible({ timeout: 30_000 });
  await expect(room.getByRole("button", { name: "Survivor", exact: true })).toHaveCount(0);
  await expect(room.getByRole("button", { name: "Bowl Pool", exact: true })).toHaveCount(1);
  await expect(room.locator(".lab-room-tag.is-bowl-pool")).toHaveCount(1);
  await room.getByRole("button", { name: "The Big Board", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "The Big Board" }).getByRole("button", { name: /Survivor/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("dialog", { name: "The Big Board" }).getByRole("button", { name: "Close" }).click();
  await room.getByRole("button", { name: "Bowl Pool", exact: true }).click();
  await expect(page).toHaveURL(/\/clubhouse#bowl$/);
});

test("the Big Board's week is a button: choosing another week shows that week's picks, with no ticket to change", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["upcoming-picked", "complete-survivor"] });
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(room).toBeVisible({ timeout: 30_000 });
  await room.getByRole("button", { name: "The Big Board", exact: true }).click();
  const board = page.getByRole("dialog", { name: "The Big Board" });
  const week = board.getByLabel("Change week");
  await expect(week).toBeVisible({ timeout: 30_000 });
  await expect(board.getByRole("button", { name: /Tap to (make|change) your picks/ })).toBeVisible();
  // The two tabs are exact mirrors: the same width and height.
  const tabs = await board.locator(".lab-tote-links > *").evaluateAll((nodes) => nodes.map((node) => { const box = node.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; }));
  expect(tabs).toHaveLength(2); expect(tabs[0]).toEqual(tabs[1]);
  await week.selectOption({ label: "Week 3 — Final" });
  await expect(board.locator("header")).toContainText("WEEK 3 · FINAL");
  await expect(board.locator(".lab-tote-ticket")).toHaveCount(0);   // a week looked back on cannot be picked in
  await expect(board.getByRole("button", { name: /Survivor/ })).toBeVisible();   // the link to the Survivor table stays
  await expect(board.locator("thead th")).toHaveCount(4);   // W, player and two picks: no Survivor column for another week
  // The board is the pool as it stood at the end of that week: every player's wins added up through it, in that order, not that week's own wins.
  expect(await board.locator("tbody .lab-tote-wins").allTextContents()).toEqual(Object.values(WEEK_TOTALS).map(String));
  await expect(board.locator("tbody .lab-tote-name").first()).toHaveText("GARY");
  // Back to this week: its own board, with the ticket bar again.
  await week.selectOption({ label: "Week 5" });
  await expect(board.locator("header")).not.toContainText("WEEK 3");
  await expect(board.locator(".lab-tote-ticket")).toBeVisible();
});

test("the ticket has the Slate's All games / Pool action switch, kept on the player's profile", async ({ page }) => {
  // The first two games are over with nobody's pick in them: Pool action leaves them out.
  const emptied = (response: BoardRead) => ({ ...response, games: response.games.map((game, index) => (index < 2 ? { ...game, awayPickers: [], homePickers: [] } : game)) });
  await openClubhouse(page, { scenarios: ["live-mixed-locks-survivor"], shapeBoard: emptied });
  const saved: unknown[] = [];
  await page.route("**/api/profile", async (route) => { if (route.request().method() === "PUT") saved.push(route.request().postDataJSON()); await route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }); });
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(room).toBeVisible({ timeout: 30_000 });
  await room.getByRole("button", { name: "Make your picks", exact: true }).click();
  const ticket = page.getByRole("dialog", { name: "Your ticket" });
  const games = ticket.locator(".lab-window-part li");
  const switcher = ticket.getByRole("group", { name: "Games shown" });
  await expect(switcher.getByRole("button", { name: "All games" })).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  const halves = await switcher.getByRole("button").evaluateAll((nodes) => nodes.map((node) => { const box = node.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; }));
  expect(halves[0]).toEqual(halves[1]);   // the two halves of the switch mirror each other
  const all = await games.count();
  expect(all).toBeGreaterThan(2);
  await switcher.getByRole("button", { name: "Pool action" }).click();
  await expect(games).toHaveCount(all - 2);
  expect(saved).toEqual([{ showPoolAction: true }]);
  await switcher.getByRole("button", { name: "All games" }).click();
  await expect(games).toHaveCount(all);
  expect(saved.at(-1)).toEqual({ showPoolAction: false });
});

test("no focus ring is left on a pop-up: not on its handle when it opens, and not round the board when the ticket is put away", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["upcoming-picked"] });
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(room).toBeVisible({ timeout: 30_000 });
  const ring = () => page.evaluate(() => { const active = document.activeElement as HTMLElement; const style = getComputedStyle(active); return { handle: active.classList.contains("cw-handle"), outline: style.outlineStyle }; });
  await room.getByRole("button", { name: "Make your picks", exact: true }).click();
  const ticket = page.getByRole("dialog", { name: "Your ticket" });
  await expect(ticket).toBeVisible({ timeout: 30_000 });
  expect(await ring()).toEqual({ handle: false, outline: "none" });   // a ticket opens with focus on the sheet, not its handle
  await ticket.getByRole("button", { name: "Close" }).click();
  await expect(ticket).toHaveCount(0);
  expect(await ring()).toEqual({ handle: false, outline: "none" });   // and the board under it shows no ring when the ticket is gone
});

test("the rules' list of articles scrolls to the article and stays on the rules", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#rules" });
  const rules = page.getByRole("dialog", { name: "Constitution" });
  await expect(rules).toBeVisible({ timeout: 30_000 });
  // No sub-line under the title, and no second "Constitution" heading above it: the page's own "Pool Constitution" is the only title shown.
  await expect(rules).not.toContainText("Everything you need to know");
  expect((await rules.locator("h2").boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  await rules.getByRole("navigation", { name: "Articles" }).getByRole("link").nth(3).click();
  await expect(rules).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Your ticket" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/clubhouse#rules$/);
  // Every clause is lettered, (a) (b) (c), so it can be cited like a lawyer's: Article III(b).
  const letters = await rules.locator(".lab-rules-article").first().locator("li").evaluateAll((items) => items.map((item) => getComputedStyle(item, "::before").content));
  expect(letters.length).toBeGreaterThan(2);
  for (const content of letters) expect(content).toContain("counter(clause, lower-alpha)");   // a, b, c in order; the browser keeps the counter in the computed value
});

test("the Survivor pop-up shows the whole table", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#survivor", homeExtra: { showSurvivorStandings: false, hideSurvivorEliminatedRows: true } });
  const popup = page.getByRole("dialog", { name: "Survivor" });
  await expect(popup).toBeVisible({ timeout: 30_000 });
  const table = popup.getByRole("region", { name: /Survivor Table/ });
  await expect(table).toBeVisible();
  await expect(table).toContainText("GARY");   // a player's own "hide" choices never blank or thin this view (and the board writes names in capitals)
});

test("the Survivor pop-up wears the Big Board's housing, with the same two tabs, a ring round each week's team and the out players struck through", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#survivor" });
  const popup = page.getByRole("dialog", { name: "Survivor" });
  await expect(popup.locator(".lab-tote.lab-survivor-tote")).toBeVisible({ timeout: 30_000 });
  await expect(popup.locator(".survivor-ledger")).toHaveCount(0);   // not the classic ledger
  // The tabs mirror the Big Board's: Survivor is the lit one here, and Big Board is the way across.
  await expect(popup.locator(".lab-tote-links [aria-current=page]")).toHaveText("Survivor");
  const tabs = await popup.locator(".lab-tote-links > *").evaluateAll((nodes) => nodes.map((node) => { const box = node.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; }));
  expect(tabs).toHaveLength(2); expect(tabs[0]).toEqual(tabs[1]);
  // A player who is out is struck through, their lost week is the red ring, and the players still in say IN.
  await expect(popup.locator("tbody tr.is-out").first()).toBeVisible();
  expect(await popup.locator("tbody tr.is-out").first().locator("th").evaluate((cell) => getComputedStyle(cell).textDecorationLine)).toBe("line-through");
  await expect(popup.locator(".lab-tote-logo.is-l").first()).toBeVisible();
  await expect(popup.locator("tbody tr:not(.is-out) .lab-tote-in").first()).toHaveText("IN");
  // Your own row is marked, and the names and status stay put while the weeks scroll sideways.
  await expect(popup.locator("tbody tr.is-you")).toHaveCount(1);
  const scroll = popup.getByRole("region", { name: /Survivor Table/ });
  const place = () => scroll.locator("tbody tr").first().locator("th").evaluate((cell) => Math.round(cell.getBoundingClientRect().left));
  const before = await place();
  await scroll.evaluate((node) => { node.scrollLeft = 300; });
  expect(await place()).toBe(before);
  // The Big Board tab goes across to the board, in the same place.
  await popup.locator(".lab-tote-links").getByRole("button", { name: "Big Board" }).click();
  await expect(page.getByRole("dialog", { name: "The Big Board" })).toBeVisible();
  await expect(page).toHaveURL(/\/clubhouse#standings$/);
});

test("the ticker keeps each game's spread on its card once the game is over, beside the final score; a game still to play shows just its line", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["complete-survivor"], size: SIZES["desktop-1280"] });
  const cards = page.locator(".lab-room-screen.is-spreads p");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const done = cards.first().locator("span.is-final").first();
  expect(await done.locator("i").innerText()).toMatch(/^([+-]\d+(\.\d)?|PK)$/);   // its line
  expect(await done.locator("em").innerText()).toMatch(/^\d+$/);                   // and its final score
  await expect(page.locator(".lab-room-screen.is-spreads p > span:not(.is-final) i")).toHaveCount(0);
});

test("a game still to play shows only its line on the ticker, with no small spread beside it", async ({ page }) => {
  await openClubhouse(page, { size: SIZES["desktop-1280"] });
  const cards = page.locator(".lab-room-screen.is-spreads p");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".lab-room-screen.is-spreads p span.is-final")).toHaveCount(0);
  expect(await cards.first().locator("span").first().locator("em").innerText()).toMatch(/^([+-]\d+(\.\d)?|PK)$/);
});

test("a pop-up has no X: sliding it down, tapping its handle or the space above it puts it away, and each one slides closed", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#rules" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const sheet = page.getByRole("dialog", { name: "Constitution" });
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  const handle = sheet.getByRole("button", { name: "Close" });
  await expect(sheet.locator(".cw-close")).toHaveCount(0);
  await expect(handle.locator("svg")).toHaveCount(0);   // the handle is a small bar, not an X
  // What the sheet is doing the instant after it is told to go: still there, and on its way down.
  const sliding = () => sheet.evaluate((dialog) => ({ open: (dialog as HTMLDialogElement).open, leaving: dialog.classList.contains("is-leaving"), moved: (dialog.querySelector(".cw-sheet-body") as HTMLElement).style.transform.startsWith("translateY(") }));
  const reopen = async () => { await page.goto("/clubhouse#rules"); await expect(sheet).toBeVisible({ timeout: 30_000 }); };
  // The handle.
  await handle.evaluate((button) => (button as HTMLButtonElement).click());
  expect(await sliding()).toEqual({ open: true, leaving: true, moved: true });
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/clubhouse$/);
  // The small empty space above the sheet.
  await reopen();
  await page.mouse.click(195, 6);
  expect(await sliding()).toEqual({ open: true, leaving: true, moved: true });
  await expect(sheet).toHaveCount(0);
  // Escape.
  await reopen();
  await page.keyboard.press("Escape");
  expect(await sliding()).toEqual({ open: true, leaving: true, moved: true });
  await expect(sheet).toHaveCount(0);
});

test("sliding a pop-up down with a finger follows the finger, springs back when it is short or sideways, and slides closed when it goes far enough", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#rules" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const sheet = page.getByRole("dialog", { name: "Constitution" });
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  // A finger from (x0, y0) to (x1, y1) on the sheet; reports what the sheet looks like before the finger lifts, and just after.
  const swipe = (x0: number, y0: number, x1: number, y1: number) => sheet.evaluate((dialog, [fx0, fy0, fx1, fy1]) => {
    const body = dialog.querySelector(".cw-sheet-body") as HTMLElement;
    const touch = (x: number, y: number) => new Touch({ identifier: 1, target: body, clientX: x, clientY: y });
    const send = (type: string, x: number | null, y: number) => body.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: x === null ? [] : [touch(x, y)], changedTouches: [touch(x ?? 0, y)] }));
    send("touchstart", fx0, fy0);
    for (let step = 1; step <= 10; step += 1) send("touchmove", fx0 + ((fx1 - fx0) * step) / 10, fy0 + ((fy1 - fy0) * step) / 10);
    const held = body.style.transform;
    send("touchend", null, fy1);
    return { held, leaving: dialog.classList.contains("is-leaving"), after: body.style.transform };
  }, [x0, y0, x1, y1] as const);
  // Across, and across and a little down: the sheet does not move (a swipe along something in it is that thing's).
  expect(await swipe(300, 400, 100, 420)).toEqual({ held: "", leaving: false, after: "" });
  // Down, but short: it follows the finger, then springs back.
  expect(await swipe(200, 300, 200, 360)).toEqual({ held: "translateY(60px)", leaving: false, after: "" });
  await expect(sheet).toBeVisible();
  // Down far enough: it follows the finger, then slides the rest of the way and closes.
  const far = await swipe(200, 300, 200, 480);
  expect(far.held).toBe("translateY(180px)");
  expect(far.leaving).toBe(true);
  await expect(sheet).toHaveCount(0);
});

/** A Bowl Pool read on the fixture's day (Sept 30): one bowl final and picked, one kicked off with no pick, two still open (one picked). */
function bowlRead(optedIn = true) {
  const team = (id: string, name: string) => ({ id, full_name: name, short_name: name });
  return {
    optedIn, entryOpen: !optedIn, season: { championship_game_id: "g4" }, entry: optedIn ? { championship_total_guess: null } : null,
    games: [
      { id: "g1", bowl_name: "Rose Bowl Game presented by Prudential", kickoff_at: "2026-09-29T21:00:00Z", status: "final", away_team_id: "a1", home_team_id: "h1", awayTeam: team("a1", "Indiana"), homeTeam: team("h1", "Ohio State"), away_score: 20, home_score: 27, line: { favorite_team_id: "h1", locked_spread: 3.5 } },
      { id: "g2", bowl_name: "Valero Alamo Bowl", kickoff_at: "2026-09-30T15:00:00Z", status: "in_progress", away_team_id: "a2", home_team_id: "h2", awayTeam: team("a2", "Texas Tech"), homeTeam: team("h2", "Oregon"), line: { favorite_team_id: "h2", locked_spread: 7.5 } },
      { id: "g3", bowl_name: "Snoozeville Mattress Bowl", kickoff_at: "2026-10-02T20:00:00Z", status: "scheduled", away_team_id: "a3", home_team_id: "h3", awayTeam: team("a3", "Duke"), homeTeam: team("h3", "Arizona"), line: { favorite_team_id: "h3", locked_spread: 2.5 } },
      { id: "g4", bowl_name: "CFP National Championship", kickoff_at: "2026-10-05T00:30:00Z", status: "scheduled", away_team_id: "a4", home_team_id: "h4", awayTeam: team("a4", "Miami"), homeTeam: team("h4", "Georgia"), line: { favorite_team_id: "h4", locked_spread: 2.5 } },
    ],
    ownPicks: optedIn ? [{ game_id: "g1", selected_team_id: "h1", result: "win" }, { game_id: "g4", selected_team_id: "a4", result: null }] : [],
    ownPreviewSelections: [],
    standings: [{ playerId: "p1", playerName: "Earl", wins: 1, losses: 1 }, { playerId: "p2", playerName: "Tyler", wins: 1, losses: 1 }],
  };
}

test("the Bowl Pool's spot opens the Bowl ticket: pennants for picks owed, the season gauge, standings, and a save that sends the open picks", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead() });
  const sheet = page.getByRole("dialog", { name: "Bowl Pool" });
  const ticket = sheet.locator(".lab-bowl-ticket");
  await expect(ticket).toBeVisible({ timeout: 30_000 });
  await expect(ticket.getByRole("img", { name: "3 of 4 bowls left" })).toBeVisible();
  await expect(ticket.locator(".lab-bowl-due")).toHaveText(/1 TO PICK/);
  await expect(ticket.locator(".lab-bowl-game")).toHaveClass([/is-done/, /is-missed/, /is-owed/, /is-picked/]);
  // A known bowl flies its own logo; one with no logo file its short name.
  await expect(ticket.locator(".lab-bowl-game").nth(0).locator(".lab-bowl-flag.is-logo image")).toHaveAttribute("href", "/bowl-logos/rose.webp");
  await expect(ticket.locator(".lab-bowl-game").nth(2).locator(".lab-bowl-flag-name")).toHaveText("SNOOZEVILLE MATTRESS");
  await expect(ticket.getByRole("button", { name: /^Ohio State -3.5, final 27, covered/ })).toBeDisabled();
  // Pick the open bowl, set the tiebreaker, save: only open bowls are sent, as the classic page sends them.
  await ticket.getByRole("button", { name: "Arizona -2.5" }).click();
  await ticket.locator(".lab-bowl-tiebreaker input").fill("47");
  await ticket.getByRole("button", { name: "Save picks" }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ optedIn: true, championshipTotalGuess: 47, selections: [{ gameId: "g3", teamId: "h3", side: "favorite" }, { gameId: "g4", teamId: "a4", side: "underdog" }] });
  await ticket.getByRole("button", { name: "Standings", exact: true }).click();
  await expect(ticket.locator(".lab-bowl-standings li.is-you")).toContainText("Tyler");
  await expect(ticket.locator(".lab-bowl-standings li").first()).toContainText("T1");
});

test("before a player claims a seat the Bowl Pool's pop-up is the Claim your seat ticket", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead(false) });
  const sheet = page.getByRole("dialog", { name: "Bowl Pool" });
  await sheet.getByRole("button", { name: "CLAIM YOUR SEAT" }).click({ timeout: 30_000 });
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ optedIn: true, selections: [], championshipTotalGuess: null });
});

test("a playoff round opens on the Big Board: a column a game, the race in a line, and a ticket that sends a pick for every game", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#standings", homeExtra: homeResponse("playoff-wildcard"), scenarios: ["playoff-upcoming"] });
  const board = page.getByRole("dialog", { name: "The Big Board" });
  await expect(board.locator(".lab-tote table.is-playoff")).toBeVisible({ timeout: 30_000 });
  await expect(board.locator(".lab-tote-race")).toContainText(/leads with \d+ · You: \d+ back|You lead/);
  await expect(board.locator("th.lab-tote-game")).toHaveCount(6);
  // Out and forfeited players are marked under their names; nobody else's pick shows before kickoff.
  await expect(board.locator("tr.is-out")).toHaveCount(3);
  await expect(board.locator("tr.is-out small").filter({ hasText: "FORFEITED" })).toHaveCount(1);
  await expect(board.locator("tr.is-you .lab-tote-owed-ring")).toHaveCount(4);
  await board.getByRole("button", { name: /4 PICKS OWED/ }).click();
  const ticket = page.getByRole("dialog", { name: "Your ticket" });
  await expect(ticket.getByRole("img", { name: /P6/ })).toHaveCount(0);
  await expect(ticket.getByRole("region", { name: "Forfeit the Pick’em season" })).toBeVisible();
  // Pick the four open games and send the whole round at once.
  const rows = ticket.locator(".lab-window-part ol > li");
  for (const index of [1, 2, 4, 5]) await rows.nth(index).locator("button").first().click();
  await ticket.getByRole("button", { name: /Submit/ }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect((sent[0] as { selections: unknown[] }).selections).toHaveLength(6);
});

test("out of the playoff race, the Big Board says so and there is no ticket", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#standings", homeExtra: homeResponse("playoff-viewer-out"), scenarios: ["playoff-eliminated"] });
  const board = page.getByRole("dialog", { name: "The Big Board" });
  await expect(board.locator(".lab-tote-race")).toContainText("You can no longer catch the leader; your score stands", { timeout: 30_000 });
  await expect(board.locator(".lab-tote-ticket")).toHaveCount(0);
  await expect(board.locator("tr.is-you")).toHaveClass(/is-out/);
});
