import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
import { homeResponse, seasonSnapshotResponse } from "./standings-fixtures.mjs";
import { boardResponse } from "./slate-fixtures.mjs";

const SIZES = { "phone-390": { width: 390, height: 844 }, "desktop-1280": { width: 1280, height: 800 } } as const;

type BoardRead = ReturnType<typeof boardResponse>;

/** Each player's wins added up through the week looked back on (the fixture's players p0 to p7): not the same as that week's own wins. */
const WEEK_TOTALS = { p0: 21, p1: 18, p2: 15, p3: 12, p4: 9, p5: 6, p6: 3, p7: 0 };

/** The real clubhouse at /clubhouse: the Standings' and the Slate's own reads, served from their fixtures. */
const sent: unknown[] = [];
async function openClubhouse(page: Page, { theme = "day", size = SIZES["phone-390"] as { width: number; height: number }, commissioner = true, clubhouseAccess = undefined as boolean | undefined, scenarios = ["upcoming-picked"], at = "/clubhouse", homeExtra = {} as Record<string, unknown>, shapeBoard = (response: BoardRead) => response, bowl = null as Record<string, unknown> | null } = {}) {
  sent.length = 0;
  await page.setViewportSize(size);
  await signIn(page, theme);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The Slate's read, one scenario per read (the last one repeats): a pick made on the Slate shows on the second read.
  const board = boardResponse(scenarios[0]);
  let reads = 0;
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: { ...homeResponse("regular-in"), seasonSnapshotReleased: true, ...homeExtra } }));
  // Like the real route, the Slate's read refuses without a week (bootstrap=1 asks for the default one).
  await page.route("**/api/board**", (route) => (new URL(route.request().url()).searchParams.get("bootstrap") === "1" ? route.fulfill({ json: shapeBoard(boardResponse(scenarios[Math.min(reads++, scenarios.length - 1)])) }) : route.fulfill({ status: 400, json: { error: "You must choose a week before viewing the board." } })));
  // The Season Snapshot (nine weeks), for the chalkboard's sketch and its full chart.
  await page.route("**/api/season-snapshot**", (route) => route.fulfill({ json: seasonSnapshotResponse("", 9) }));
  await page.route("**/api/board-totals**", (route) => route.fulfill({ json: { weekId: new URL(route.request().url()).searchParams.get("week"), totals: WEEK_TOTALS } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: commissioner, showPoolChat: false, ...(clubhouseAccess === undefined ? {} : { clubhouseAccess }) } }));
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
  await opens("Trophy Room", "Trophy Room", /Pennants|No champions yet|20\d\d/);
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
  const tabs = page.getByRole("dialog", { name: "The Big Board" }).getByRole("navigation", { name: "Board" });
  await expect(tabs.locator("[aria-current=page]")).toHaveText("Big Board");
  await tabs.getByRole("button", { name: "Survivor" }).click();
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
  await expect(ticket).toContainText("3 LEFT", { timeout: 30_000 });   // nothing picked: three places open
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
  await expect(page.getByRole("button", { name: /YOUR TICKET/ })).toContainText("LAR −3");   // the picks show on the ticket at once
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

test("putting the ticket away with picks not sent asks first: go back keeps them, leave drops them, send sends them", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["upcoming-unpicked", "upcoming-picked"] });
  await page.getByRole("button", { name: /YOUR TICKET/ }).click({ timeout: 30_000 });
  const form = page.getByRole("dialog", { name: "Your ticket" });
  await form.locator(".lab-window-part .lab-board-cell:not([disabled])").nth(0).click();
  const ask = page.getByRole("dialog", { name: "Your picks aren’t sent yet" });
  // Closing asks, and going back leaves the ticket as it was, the pick still on it.
  await page.keyboard.press("Escape");
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Go back to my ticket" }).click();
  await expect(ask).toHaveCount(0);
  await expect(form).toBeVisible();
  await expect(form.getByRole("button", { name: /Submit picks/ })).toBeEnabled();
  // Another tab asks too; leaving without sending sends nothing.
  await page.getByRole("navigation", { name: "Board" }).getByRole("button", { name: "Big Board" }).click();
  await ask.getByRole("button", { name: "Leave without sending" }).click();
  await expect(page.getByRole("dialog", { name: "The Big Board" })).toBeVisible();
  expect(sent).toHaveLength(0);
  // The phone's back gesture asks too; Send my picks sends them and carries on, and the Big Board says when they were saved.
  await page.getByRole("navigation", { name: "Board" }).getByRole("button", { name: "Ticket" }).click();
  const again = page.getByRole("dialog", { name: "Your ticket" });
  const cells = again.locator(".lab-window-part .lab-board-cell:not([disabled])");
  await cells.nth(0).click();
  await cells.nth(2).click();
  await page.goBack();
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Send my picks" }).click();
  await expect.poll(() => sent.length).toBe(1);
  await expect(ask).toHaveCount(0);
});

test("a ticket sent says so on the Big Board's bar, with the time it was saved", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["upcoming-unpicked", "upcoming-picked"] });
  await page.getByRole("button", { name: /YOUR TICKET/ }).click({ timeout: 30_000 });
  const form = page.getByRole("dialog", { name: "Your ticket" });
  const cells = form.locator(".lab-window-part .lab-board-cell:not([disabled])");
  await cells.nth(0).click();
  await cells.nth(2).click();
  await form.getByRole("button", { name: /Submit picks/ }).click();
  await expect(page.getByRole("dialog", { name: "The Big Board" }).locator(".lab-tote-ticket")).toContainText(/PICKS SAVED ✓.*Saved at \d{1,2}:\d{2} [AP]M/);
});

test("the ticket says what the line colours mean while a line can still move", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["upcoming-unpicked"], at: "/clubhouse#slate" });
  await expect(page.getByRole("dialog", { name: "Your ticket" }).locator(".lab-line-key")).toContainText("8 AM on game day", { timeout: 30_000 });
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

test("with the switch up, opening the app goes straight to the clubhouse without waiting for the account (the Standings never show first)", async ({ page }) => {
  await openClubhouse(page, { at: "/board" });
  await page.evaluate(() => window.localStorage.setItem("pickem-clubhouse-mode", "on"));
  let profileAnsweredAt = 0;
  await page.route("**/api/profile**", async (route) => { await new Promise((resolve) => setTimeout(resolve, 3000)); profileAnsweredAt = Date.now(); await route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }); });
  await page.goto("/");
  await page.waitForURL(/\/clubhouse$/, { timeout: 30_000 });
  expect(profileAnsweredAt).toBe(0);   // left for the clubhouse before the account was read
});

test("with the switch up, the Standings link on another page goes straight to the clubhouse, never through the classic Standings", async ({ page }) => {
  await openClubhouse(page, { at: "/board" });
  await page.evaluate(() => window.localStorage.setItem("pickem-clubhouse-mode", "on"));
  await page.goto("/board");
  const standings = page.locator("nav a:visible", { hasText: "Standings" }).first();
  await expect(standings).toHaveAttribute("href", "/clubhouse", { timeout: 30_000 });
  // The classic Standings page never renders on the way.
  let classicShown = false;
  await page.exposeFunction("classicStandingsShown", () => { classicShown = true; });
  await page.evaluate(() => new MutationObserver(() => { if (document.querySelector("h1")?.textContent?.trim() === "Standings") (window as unknown as { classicStandingsShown: () => void }).classicStandingsShown(); }).observe(document.body, { childList: true, subtree: true }));
  await standings.click();
  await page.waitForURL(/\/clubhouse$/, { timeout: 30_000 });
  await page.waitForTimeout(500);
  expect(classicShown).toBe(false);
  // With the switch down it is the classic Standings again.
  await page.evaluate(() => window.localStorage.setItem("pickem-clubhouse-mode", "off"));
  await page.goto("/board");
  await expect(page.locator("nav a:visible", { hasText: "Standings" }).first()).toHaveAttribute("href", "/", { timeout: 30_000 });
});

test("a player sent back from the clubhouse has the switch put down, so the Standings do not send them straight back", async ({ page }) => {
  await openClubhouse(page, { at: "/board", commissioner: false, clubhouseAccess: false });
  await page.evaluate(() => window.localStorage.setItem("pickem-clubhouse-mode", "on"));
  await page.goto("/");
  // Off to the clubhouse, refused, the switch put down, and back to the Standings to stay.
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("pickem-clubhouse-mode")), { timeout: 30_000 }).toBe("off");
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Standings", level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/$/);   // and it stays
});

test("a player who is not the Commissioner is sent to the Standings and has no switch", async ({ page }) => {
  await openClubhouse(page, { commissioner: false });
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Clubhouse view|Classic view/ })).toHaveCount(0);
});

test("a player the Commissioner has let into the clubhouse beta gets the room and the switch", async ({ page }) => {
  await openClubhouse(page, { commissioner: false, clubhouseAccess: true });
  await expect(page.getByRole("navigation", { name: "Clubhouse rooms" })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/clubhouse$/);
  await expect(page.getByRole("link", { name: "Classic view" }).first()).toBeVisible();
});

test("a player the Commissioner has not let in is sent to the Standings, whatever the clubhouse beta says of others", async ({ page }) => {
  await openClubhouse(page, { commissioner: false, clubhouseAccess: false });
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Clubhouse view|Classic view/ })).toHaveCount(0);
});

test("a finished game on the ticket shows each side's final score and who covered, a game being played shows who took each side, and there is no lock over the line", async ({ page }) => {
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
  // A game that has kicked off but is not final shows no score, only who took each side.
  const live = form.locator("ol > li").nth(2);
  await expect(live.locator(".lab-board-final b")).toHaveCount(0);
  await expect(live.locator(".lab-board-final.is-live")).toHaveText(["MIKE · PAT", "DANA · SAM"]);
  await live.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("clubhouse-ticket-live-pickers-phone-390.png", { maxDiffPixels: 40 });
});

for (const [phase, homeExtra, table] of [
  ["while Survivor runs", {}, "Survivor"],
  ["with Survivor decided and the Bowl Pool not yet open", { survivorComplete: true, survivorChampionName: "Walt", survivorCrownedAt: "2026-09-20T12:00:00Z" }, null],
  ["in bowl season with Survivor decided", { survivorComplete: true, survivorChampionName: "Walt", survivorCrownedAt: "2026-09-20T12:00:00Z", serverTime: "2026-12-10T18:00:00Z" }, "Bowl Pool"],
] as const) {
  test(`the poker table shows only the pool being played, and the board's tabs are always all four, ${phase}`, async ({ page }) => {
    await openClubhouse(page, { homeExtra, bowl: bowlRead() });
    const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
    await expect(room).toBeVisible({ timeout: 30_000 });
    await expect(room.getByRole("button", { name: "Survivor", exact: true })).toHaveCount(table === "Survivor" ? 1 : 0);
    await expect(room.getByRole("button", { name: "Bowl Pool", exact: true })).toHaveCount(table === "Bowl Pool" ? 1 : 0);
    if (table === "Bowl Pool") {
      await expect(room.locator(".lab-room-tag.is-bowl-pool")).toHaveCount(1);
      await room.getByRole("button", { name: "Bowl Pool", exact: true }).click();
      await expect(page).toHaveURL(/\/clubhouse#bowl$/);
      await page.getByRole("dialog", { name: "Bowl Pool" }).getByRole("button", { name: "Close" }).click();
    }
    await room.getByRole("button", { name: "The Big Board", exact: true }).click();
    const tabs = page.getByRole("dialog", { name: "The Big Board" }).getByRole("navigation", { name: "Board" });
    await expect(tabs.getByRole("button")).toHaveText(["Bowl Pool", "Survivor", "Ticket", "Big Board"], { timeout: 30_000 });
  });
}

for (const [label, size, theme] of [["phone-390", SIZES["phone-390"], "day"], ["phone-390", SIZES["phone-390"], "night"], ["desktop-1280", SIZES["desktop-1280"], "day"]] as const) {
  test(`the Notifications pop-up looks like the clubhouse, at ${label} by ${theme}`, async ({ page }) => {
    await openClubhouse(page, { at: "/clubhouse#notifications", theme, size });
    const sheet = page.getByRole("dialog", { name: "Notifications" });
    await expect(sheet.getByText("Send pool emails to this address")).toBeVisible({ timeout: 30_000 });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`clubhouse-notifications-${theme}-${label}.png`, { maxDiffPixels: 40 });
  });
}

test("the Notifications pop-up's email plans and fine-tune choices wear the clubhouse's navy and gold", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#notifications", theme: "day" });
  const sheet = page.getByRole("dialog", { name: "Notifications" });
  await sheet.getByLabel(/Send pool emails to this address/).check({ timeout: 30_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
  await sheet.getByRole("heading", { name: "CHOOSE YOUR EMAIL PLAN" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await expect(page).toHaveScreenshot("clubhouse-notifications-plans-phone-390.png", { maxDiffPixels: 40 });
});

for (const [label, size] of [["phone-390", SIZES["phone-390"]], ["desktop-1280", SIZES["desktop-1280"]]] as const) {
  test(`the arrow above the ticket tucks it to about half its height and opens it again, and the ticket itself still opens your ticket, at ${label}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });   // the fold plays instantly, so the sizes below are the settled ones
    await openClubhouse(page, { size });
    const ticket = page.locator(".clubhouse-page .lab-room-ticket");
    const arrow = page.getByRole("button", { name: /Tuck your ticket away|Open up your ticket/ });
    await expect(ticket).toBeVisible({ timeout: 30_000 });
    await expect(arrow).toHaveAttribute("aria-expanded", "true");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
    const whole = (await ticket.boundingBox())!;
    const tabBox = (await arrow.boundingBox())!;
    expect(tabBox.y + tabBox.height, "the arrow sits just above the ticket").toBeLessThanOrEqual(whole.y + 1);
    await arrow.click();
    await expect(ticket.locator(".slip")).toHaveClass(/is-tucked/);
    await expect(arrow).toHaveAttribute("aria-expanded", "false");
    await expect(arrow).toHaveAccessibleName("Open up your ticket");
    await expect(page.getByRole("dialog")).toHaveCount(0);   // the arrow did not open the ticket
    const tucked = (await ticket.boundingBox())!;
    expect(tucked.height, "about half as tall").toBeLessThan(whole.height * 0.7);
    await expect(ticket.locator(".slip-place")).toHaveCount(3);   // every pick still on it
    await expect(page).toHaveScreenshot(`clubhouse-ticket-tucked-${label}.png`, { maxDiffPixels: 40 });
    // It stays tucked after a reload; the arrow opens it again, and a tap on the ticket opens your ticket.
    await page.reload();
    await expect(page.locator(".clubhouse-page .lab-room-ticket .slip")).toHaveClass(/is-tucked/, { timeout: 30_000 });
    await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
    await arrow.click();
    await expect(ticket.locator(".slip")).not.toHaveClass(/is-tucked/);
    await expect(arrow).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await ticket.click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });
}

test("Notifications is a plate in the room's glass doors, like the others: it opens the player's notification settings in place, and the name menu leaves it out", async ({ page }) => {
  await openClubhouse(page);
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(room).toBeVisible({ timeout: 30_000 });
  await page.getByRole("navigation", { name: "Account navigation" }).getByRole("button", { name: /Tyler/ }).click();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Notifications" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await room.getByRole("button", { name: "Notifications", exact: true }).click();
  await expect(page).toHaveURL(/\/clubhouse#notifications$/);
  await expect(page.getByRole("dialog", { name: "Notifications" }).getByText("Send pool emails to this address")).toBeVisible({ timeout: 30_000 });
});

test("the Survivor table's Make pick opens your ticket on Survivor", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#survivor" });
  const sheet = page.getByRole("dialog", { name: "Survivor" });
  await sheet.getByRole("button", { name: /Make pick/ }).click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/clubhouse#slate$/);
  await expect(page.getByRole("dialog", { name: "Your ticket" }).getByRole("group", { name: "What to pick" }).getByRole("button", { name: /^Survivor/ })).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
});

test("the Big Board's week is a button: choosing another week shows that week's picks, with no ticket to change", async ({ page }) => {
  await openClubhouse(page, { scenarios: ["upcoming-picked", "complete-survivor"] });
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(room).toBeVisible({ timeout: 30_000 });
  await room.getByRole("button", { name: "The Big Board", exact: true }).click();
  const board = page.getByRole("dialog", { name: "The Big Board" });
  const week = board.getByLabel("Change week");
  await expect(week).toBeVisible({ timeout: 30_000 });
  await expect(board.getByRole("button", { name: /Tap here to (pick|change a pick)/ })).toBeVisible();
  // The switch's three tabs (Big Board, Ticket, Survivor) are exact mirrors: the same width and height.
  const tabs = await board.locator(".club-deck-tabs > *").evaluateAll((nodes) => nodes.map((node) => { const box = node.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; }));
  expect(tabs).toHaveLength(4); for (const tab of tabs) expect(tab).toEqual(tabs[0]);
  await week.selectOption({ label: "Week 3 — Final" });
  await expect(board.locator("header")).toContainText("WEEK 3 · FINAL");
  await expect(board.locator(".lab-tote-ticket")).toHaveCount(0);   // a week looked back on cannot be picked in
  await expect(board.getByRole("button", { name: /Survivor/ })).toBeVisible();   // the link to the Survivor table stays
  await expect(board.locator("thead th")).toHaveCount(4);   // W, player and two picks: no Survivor column for another week
  // The board is the pool as it stood at the end of that week: every player's wins added up through it, in that order, not that week's own wins.
  expect(await board.locator("tbody .lab-tote-wins").allTextContents()).toEqual(Object.values(WEEK_TOTALS).map(String));
  await expect(board.locator("tbody .lab-tote-name").first()).toHaveText(/^GARY/);
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

test("the Survivor pop-up wears the Big Board's housing, under the board's switch, a ring round each week's team and the out players dimmed, not crossed off", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#survivor" });
  const popup = page.getByRole("dialog", { name: "Survivor" });
  await expect(popup.locator(".lab-tote.lab-survivor-tote")).toBeVisible({ timeout: 30_000 });
  await expect(popup.locator(".survivor-ledger")).toHaveCount(0);   // not the classic ledger
  // The board's switch: Survivor is the lit one here, and Big Board and Ticket are the ways across.
  await expect(popup.locator(".club-deck-tabs [aria-current=page]")).toHaveText("Survivor");
  await expect(popup.locator(".club-deck-tabs > *")).toHaveText(["Bowl Pool", "Survivor", "Ticket", "Big Board"]);
  // A player who is out is dimmed (never crossed off), their lost week is the red ring, and the players still in say IN.
  await expect(popup.locator("tbody tr.is-out").first()).toBeVisible();
  expect(await popup.locator("tbody tr.is-out").first().locator("th").evaluate((cell) => getComputedStyle(cell).textDecorationLine)).toBe("none");
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
  await popup.locator(".club-deck-tabs").getByRole("button", { name: "Big Board" }).click();
  await expect(page.getByRole("dialog", { name: "The Big Board" })).toBeVisible();
  await expect(page).toHaveURL(/\/clubhouse#standings$/);
});

/** Scrolled all the way along, every held (sticky) column sits flush with its scroller's left edge: nothing scrolls past to its left. */
async function heldColumnsFlush(region: import("@playwright/test").Locator) {
  return region.evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
    const edge = node.getBoundingClientRect().left + node.clientLeft;
    const held = [...node.querySelectorAll<HTMLElement>("th, td")].filter((cell) => getComputedStyle(cell).position === "sticky" && getComputedStyle(cell).left === "0px");
    return held.length > 0 && held.every((cell) => Math.abs(cell.getBoundingClientRect().left - edge) <= 1);
  });
}

test("the Survivor table and the Bowl sheet hold their left columns flush with the edge while they scroll", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#survivor", bowl: bowlRead() });
  const survivor = page.getByRole("dialog", { name: "Survivor" }).getByRole("region", { name: /Survivor Table/ });
  await expect(survivor).toBeVisible({ timeout: 30_000 });
  expect(await heldColumnsFlush(survivor)).toBe(true);
  await page.getByRole("navigation", { name: "Board" }).getByRole("button", { name: "Bowl Pool" }).click();
  await page.getByRole("button", { name: "Sheet", exact: true }).click({ timeout: 30_000 });
  expect(await heldColumnsFlush(page.getByRole("region", { name: "Bowl sheet, scrolls sideways" }))).toBe(true);
});

test("opening the clubhouse loads one room picture (the one on screen), never the phone's on a desktop, and reads the Trophy Room only once the room has settled", async ({ page }) => {
  const asked: Array<{ at: number; path: string }> = [];
  const start = Date.now();
  page.on("request", (request) => { const path = new URL(request.url()).pathname; if (path.includes("/lab/clubhouse/room-") || path.startsWith("/api/trophy-room")) asked.push({ at: Date.now() - start, path }); });
  await openClubhouse(page, { size: SIZES["desktop-1280"], theme: "night" });
  await expect(page.getByRole("navigation", { name: "Clubhouse rooms" })).toBeVisible({ timeout: 30_000 });
  const shown = Date.now() - start;
  const early = asked.filter((entry) => entry.at <= shown + 500).map((entry) => entry.path);
  expect(early.filter((path) => path.includes("/room-"))).toEqual(["/lab/clubhouse/room-night-wide.webp"]);
  expect(early.some((path) => path.startsWith("/api/trophy-room"))).toBe(false);
  await expect.poll(() => asked.some((entry) => entry.path.startsWith("/api/trophy-room")), { timeout: 10_000 }).toBe(true);
  expect(asked.some((entry) => entry.path.endsWith("-full.webp"))).toBe(false);
});

test("until the loading football's spin frames are ready it shows the ball itself, still, never a grey ghost of one", async ({ page }) => {
  await openClubhouse(page);
  await expect(page.getByRole("navigation", { name: "Clubhouse rooms" })).toBeVisible({ timeout: 30_000 });
  // Open it again with the frames never arriving and the pool's read held, so the loading screen stays up.
  await page.route("**/football-spin.webp", (route) => route.abort());
  await page.route("**/api/home**", () => undefined);
  await page.goto("/clubhouse", { waitUntil: "commit" });
  const ball = page.locator(".football-loader-ball").first();
  await expect(ball).toBeVisible({ timeout: 30_000 });
  await expect(ball).not.toHaveClass(/is-ready/);
  expect(await ball.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain("football-still.webp");
});

test("pulling down to refresh in the clubhouse reads the room again in place: no reload, no loading screen", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));   // pull to refresh runs in the installed app
  let homeReads = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/home") homeReads += 1; });
  await openClubhouse(page);
  await expect(page.getByRole("navigation", { name: "Clubhouse rooms" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveClass(/has-pull-refresh/);
  await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true; });
  const before = homeReads;
  await page.evaluate(() => {
    const target = document.body;
    const touch = (y: number) => new Touch({ identifier: 1, target, clientX: 195, clientY: y });
    const send = (type: string, y: number | null) => target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: y === null ? [] : [touch(y)], changedTouches: [touch(y ?? 0)] }));
    send("touchstart", 100);
    for (let step = 1; step <= 10; step += 1) send("touchmove", 100 + (160 * step) / 10);
    send("touchend", null);
  });
  await expect.poll(() => homeReads, { timeout: 10_000 }).toBeGreaterThan(before);
  await expect(page.locator(".pull-refresh-cover")).toHaveCount(0);   // no loading screen over the room
  await expect(page.locator(".pull-chain")).toHaveCount(0, { timeout: 10_000 });   // the chain goes once the room is read
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);   // the same page: no reload
});

test("on a phone the Survivor table shows five weeks without scrolling", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#survivor", size: SIZES["phone-390"] });
  const scroll = page.getByRole("dialog", { name: "Survivor" }).getByRole("region", { name: /Survivor Table/ });
  await expect(scroll).toBeVisible({ timeout: 30_000 });
  const weeks = await scroll.locator("thead th").count() - 2;
  expect(weeks).toBeGreaterThanOrEqual(5);
  const fits = await scroll.evaluate((node, shown) => {
    const cells = [...node.querySelectorAll("thead th")];
    const last = cells[Math.min(cells.length - 1, 1 + shown)].getBoundingClientRect(), box = node.getBoundingClientRect();
    node.scrollLeft = 0;
    return cells[Math.min(cells.length - 1, 1 + shown)].getBoundingClientRect().right <= box.right + 1 && last.width > 0;
  }, 5);
  expect(fits).toBe(true);
});

test("once Survivor is decided its table has no week after the last one played", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#survivor", homeExtra: { survivorComplete: true, survivorChampionName: "Walt", survivorCrownedAt: "2026-10-01T12:00:00Z" } });
  const scroll = page.getByRole("dialog", { name: "Survivor" }).getByRole("region", { name: /Survivor Table/ });
  await expect(scroll).toBeVisible({ timeout: 30_000 });
  const weeks = await scroll.locator("thead th").evaluateAll((cells) => cells.slice(2).map((cell) => Number(cell.textContent)));
  const picked = await scroll.locator("tbody tr").evaluateAll((rows) => Math.max(0, ...rows.map((row) => [...row.querySelectorAll("td")].slice(1).reduce((last, cell, index) => (cell.children.length ? index + 1 : last), 0))));
  expect(weeks.at(-1)).toBe(picked);
});

test("Survivor shows only the weeks played so far and the next one, and opens on the latest week, not week 1", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#survivor", size: SIZES["phone-390"] });
  const popup = page.getByRole("dialog", { name: "Survivor" });
  const scroll = popup.getByRole("region", { name: /Survivor Table/ });
  await expect(scroll).toBeVisible({ timeout: 30_000 });
  const weeks = await scroll.locator("thead th").evaluateAll((cells) => cells.slice(2).map((cell) => Number(cell.textContent)));
  const picked = await scroll.locator("tbody tr").evaluateAll((rows) => Math.max(0, ...rows.map((row) => [...row.querySelectorAll("td")].slice(1).reduce((last, cell, index) => (cell.children.length ? index + 1 : last), 0))));
  expect(weeks.at(-1)).toBeLessThan(18);
  expect(weeks.at(-1)).toBe(picked + 1);
  // Scrolled all the way along, so the latest week is in view.
  await expect.poll(() => scroll.evaluate((node) => node.scrollWidth - node.clientWidth - node.scrollLeft)).toBeLessThanOrEqual(1);
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
  // What the sheet did once told to go: stayed open while it was marked leaving and its paper was moved down. Watched as it happens (a
  // slow machine can finish the quarter-second slide before a test could look), then read back once the sheet is gone.
  const watch = () => sheet.evaluate((dialog) => {
    const seen = { open: false, leaving: false, moved: false };
    (window as unknown as { slid: typeof seen }).slid = seen;
    const body = dialog.querySelector(".cw-sheet-body") as HTMLElement;
    const look = () => { if ((dialog as HTMLDialogElement).open && dialog.classList.contains("is-leaving") && body.style.transform.startsWith("translateY(")) Object.assign(seen, { open: true, leaving: true, moved: true }); };
    new MutationObserver(look).observe(dialog, { attributes: true, subtree: true, attributeFilter: ["class", "style"] });
  });
  const sliding = async () => { await expect(sheet).toHaveCount(0); return page.evaluate(() => (window as unknown as { slid: unknown }).slid); };
  // A fresh load each time: going to the same page with only a new #hash is not a real load, and could race the sheet just put away.
  const reopen = async () => { await page.goto("/clubhouse#rules"); await page.reload(); await expect(sheet).toBeVisible({ timeout: 30_000 }); };
  // The handle.
  await watch();
  await handle.evaluate((button) => (button as HTMLButtonElement).click());
  expect(await sliding()).toEqual({ open: true, leaving: true, moved: true });
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/clubhouse$/);
  // The small empty space above the sheet.
  await reopen();
  await watch();
  await page.mouse.click(195, 6);
  expect(await sliding()).toEqual({ open: true, leaving: true, moved: true });
  await expect(sheet).toHaveCount(0);
  // Escape.
  await reopen();
  await watch();
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
      { id: "g1", bowl_name: "Rose Bowl Game presented by Prudential", kickoff_at: "2026-09-29T21:00:00Z", status: "final", venue_city: "Pasadena", venue_state: "CA", away_team_id: "a1", home_team_id: "h1", awayTeam: team("a1", "Indiana"), homeTeam: team("h1", "Ohio State"), away_score: 20, home_score: 27, line: { favorite_team_id: "h1", locked_spread: 3.5 } },
      { id: "g2", bowl_name: "CFP First Round", kickoff_at: "2026-09-30T15:00:00Z", status: "in_progress", venue_city: "Glendale", venue_state: "AZ", away_team_id: "a2", home_team_id: "h2", awayTeam: team("a2", "Texas Tech"), homeTeam: team("h2", "Oregon"), line: { favorite_team_id: "h2", locked_spread: 7.5 } },
      { id: "g3", bowl_name: "Snoozeville Mattress Bowl", kickoff_at: "2026-10-02T20:00:00Z", status: "scheduled", venue_city: "Boise", venue_state: "ID", away_team_id: "a3", home_team_id: "h3", awayTeam: team("a3", "Duke"), homeTeam: team("h3", "Arizona"), line: { favorite_team_id: "h3", locked_spread: 2.5 } },
      { id: "g4", bowl_name: "CFP National Championship", kickoff_at: "2026-10-05T00:30:00Z", status: "scheduled", venue_city: "Atlanta", venue_state: "GA", away_team_id: "a4", home_team_id: "h4", awayTeam: team("a4", "Miami"), homeTeam: team("h4", "Georgia"), line: { favorite_team_id: "h4", locked_spread: 2.5 } },
    ],
    ownPicks: optedIn ? [{ game_id: "g1", selected_team_id: "h1", result: "win" }, { game_id: "g4", selected_team_id: "a4", result: null }] : [],
    ownPreviewSelections: [],
    standings: [{ playerId: "p1", playerName: "Earl", wins: 1, losses: 1 }, { playerId: "p2", playerName: "Tyler", wins: 1, losses: 1, trophies: ["Bowl Pool Champion 2025"], holdsTrophy: true }],
    // Earl's picks as the Bowl Pool's read gives them: shown once a bowl kicks off, only a marker before (and a missed bowl a loss).
    publicPicks: [{ playerId: "p1", game_id: "g1", selected_team_id: "a1", result: "loss" }],
    automaticResults: [{ playerId: "p1", game_id: "g2", result: "loss" }],
    privatePickMarkers: [{ playerId: "p1", game_id: "g3" }],
  };
}

test("the Bowl Pool's spot opens the Bowl ticket: pennants for picks owed, the season gauge, standings, and a save that sends the open picks", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead() });
  const sheet = page.getByRole("dialog", { name: "Bowl Pool" });
  const ticket = sheet.locator(".lab-bowl-ticket");
  await expect(ticket).toBeVisible({ timeout: 30_000 });
  await expect(ticket.getByRole("img", { name: "3 of 4 games left" })).toBeVisible();
  await expect(ticket.locator(".lab-bowl-counts .is-owed dd")).toHaveText("1");   // to pick
  await expect(ticket.locator(".lab-bowl-game")).toHaveClass([/is-done/, /is-missed/, /is-owed/, /is-picked/]);
  // A known bowl flies its own logo; one with no logo file its short name.
  await expect(ticket.locator(".lab-bowl-game").nth(1).locator(".lab-bowl-flag.is-logo image")).toHaveAttribute("href", "/bowl-logos/cfp.webp");   // a first-round game on campus flies the playoff's logo
  await expect(ticket.locator(".lab-bowl-game").nth(0).locator(".lab-bowl-flag.is-logo image")).toHaveAttribute("href", "/bowl-logos/rose.webp");
  await expect(ticket.locator(".lab-bowl-game").nth(2).locator(".lab-bowl-flag-name")).toHaveText("SNOOZEVILLE MATTRESS");
  await expect(ticket.getByRole("button", { name: /^Ohio State -3.5, final 27, covered/ })).toBeDisabled();
  // Pick the open bowl, set the tiebreaker, save: only open bowls are sent, as the classic page sends them.
  await ticket.getByRole("button", { name: "Arizona -2.5" }).click();
  await ticket.getByRole("textbox", { name: /Tiebreaker/ }).fill("47");
  await ticket.getByRole("button", { name: "Save picks" }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ optedIn: true, championshipTotalGuess: 47, selections: [{ gameId: "g3", teamId: "h3", side: "favorite" }, { gameId: "g4", teamId: "a4", side: "underdog" }] });
  // The standings are the Sheet's first column, so there is no separate Standings tab.
  await expect(ticket.getByRole("button", { name: "Standings", exact: true })).toHaveCount(0);
  await ticket.getByRole("button", { name: "Sheet", exact: true }).click();
  await expect(ticket.locator(".lab-bowl-sheet tbody tr.is-you")).toContainText("Tyler");
});

test("the Bowl tiebreaker sits in the title game's own box, and saving without it reminds you", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead() });
  const ticket = page.getByRole("dialog", { name: "Bowl Pool" }).locator(".lab-bowl-ticket");
  const box = ticket.locator(".lab-window-ticket");
  const titleGame = ticket.locator(".lab-bowl-game").nth(3);
  await expect(titleGame.getByRole("textbox", { name: /Tiebreaker/ })).toBeVisible({ timeout: 30_000 });
  await expect(titleGame).toContainText("Closest wins.");
  // The tiebreaker spans the game's whole width, edge to edge with its two teams.
  const [guess, teams] = await Promise.all([titleGame.locator(".lab-bowl-guess").boundingBox(), titleGame.locator(".lab-board-cell").evaluateAll((cells) => { const boxes = cells.map((cell) => cell.getBoundingClientRect()); return { left: Math.min(...boxes.map((box) => box.left)), right: Math.max(...boxes.map((box) => box.right)) }; })]);
  expect(Math.abs(guess!.x - teams.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(guess!.x + guess!.width - teams.right)).toBeLessThanOrEqual(1);
  await expect(box.getByRole("textbox", { name: /Tiebreaker/ })).toHaveCount(0);
  await ticket.getByRole("button", { name: "Arizona -2.5" }).click();
  await box.getByRole("button", { name: "Save picks" }).click();
  await expect.poll(() => sent.length).toBe(1);
  await expect(box.getByRole("status")).toContainText("Don’t forget your tiebreaker");
  await expect(box.getByRole("button", { name: /Saved at/ })).toBeVisible();
});

test("closing the Bowl ticket with picks not saved asks first", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead() });
  const ticket = page.getByRole("dialog", { name: "Bowl Pool" }).locator(".lab-bowl-ticket");
  await ticket.getByRole("button", { name: "Arizona -2.5" }).click({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  const ask = page.getByRole("dialog", { name: "Your bowl picks aren’t saved yet" });
  await ask.getByRole("button", { name: "Save my picks" }).click();
  await expect.poll(() => sent.length).toBe(1);
  await expect(page.getByRole("dialog", { name: "Bowl Pool" })).toHaveCount(0);
});

test("in bowl season the room's ticker carries the bowls too, by the schools' short names under the bowl's name", async ({ page }) => {
  await openClubhouse(page, { bowl: bowlRead(), homeExtra: { serverTime: "2026-12-10T18:00:00Z" } });
  const ticker = page.locator(".lab-room-screen.is-spreads");
  await expect(ticker.locator("p.is-bowl").first()).toBeAttached({ timeout: 30_000 });
  await expect(ticker.locator("p.is-bowl").first().locator("small")).toContainText("·");
  await expect(ticker.locator("p:not(.is-bowl)").first()).toBeAttached();   // the NFL games are still there
});

test("tapping the room's ceiling light turns the lights down for night, and again back up for day", async ({ page }) => {
  await openClubhouse(page);
  const lamp = page.getByRole("button", { name: /Turn the lights down \(night\): the ceiling light/ });
  await lamp.click({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.getByRole("button", { name: /Turn the lights up \(day\): the ceiling light/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
});

test("only the ceiling light changes day and night: the bar has no lamp that does, on a desktop or a phone", async ({ page }) => {
  for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await openClubhouse(page);
    await expect(page.getByRole("button", { name: /Turn the lights (down|up).*ceiling light/ })).toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /bar lamp/ })).toHaveCount(0);
  }
});

test("tapping the chalkboard opens the Season Snapshot and tapping the bottles behind the bar opens Pool chat, on a desktop and a phone", async ({ page }) => {
  for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await openClubhouse(page);
    const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
    for (const [spot, dialog] of [["Chalkboard: open Season Snapshot", "Season Snapshot"], ["Bottles on the back bar: open Pool chat", "Pool chat"]] as const) {
      const target = room.getByRole("button", { name: spot });
      await expect(target).toBeVisible({ timeout: 30_000 });
      const box = (await target.boundingBox())!;
      // A tap in the middle of the picture's thing (not on a plate) reaches it: nothing else is on top there.
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByRole("dialog", { name: dialog })).toBeVisible({ timeout: 30_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: dialog })).toBeHidden();
    }
  }
});

test("the Bowl ticket's Sheet is everyone's picks on every bowl: a school once a bowl kicks off, a lit lamp for a hidden pick, an unlit one for none", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead() });
  const ticket = page.getByRole("dialog", { name: "Bowl Pool" }).locator(".lab-bowl-ticket");
  await ticket.getByRole("button", { name: "Sheet", exact: true }).click({ timeout: 30_000 });
  const sheet = ticket.getByRole("region", { name: /Bowl sheet/ });
  await expect(sheet.locator("tbody tr")).toHaveCount(2);
  await expect(sheet.getByLabel(/^Earl, Rose Bowl Game[^:]*: \w+, lost$/)).toBeAttached();   // the Bowl Card's own names for the bowl and the school
  await expect(sheet.getByRole("img", { name: /Earl, .*: pick in, hidden until kickoff/ })).toHaveCount(1);
  await expect(sheet.getByRole("img", { name: /Earl, .*: no pick$/ })).toHaveCount(1);
  await expect(sheet.getByLabel(/^Tyler, Rose Bowl Game[^:]*: [\w ]+, won$/)).toBeAttached();
  await expect(sheet.getByLabel("Tyler, CFP First Round: no pick, a loss")).toBeAttached();
  // Wins only, on the Bowl Card's flip tiles; every bowl column the same width.
  await expect(sheet.locator("thead th").first()).toHaveText("Wins");
  const widths = await sheet.locator("col.lab-bowl-sheet-col-game").evaluateAll((cols) => cols.map((col) => Math.round(col.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBe(1);   // a bowl that kicked off without a pick
});

test("the Bowl sheet stops with a game column framed beside the player columns, never part way", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead() });
  const ticket = page.getByRole("dialog", { name: "Bowl Pool" }).locator(".lab-bowl-ticket");
  await ticket.getByRole("button", { name: "Sheet", exact: true }).click({ timeout: 30_000 });
  const scroller = ticket.locator(".lab-bowl-sheet-scroll");
  await expect(scroller).toBeVisible();
  expect(await scroller.evaluate((node) => getComputedStyle(node).scrollSnapType)).toContain("mandatory");
  expect(await scroller.locator("thead th").nth(2).evaluate((node) => getComputedStyle(node).scrollSnapAlign)).toBe("start");
  // Let go anywhere and it settles on a column's left edge (just past the held columns).
  await scroller.evaluate((node) => node.scrollTo({ left: 37, behavior: "instant" }));
  await page.waitForTimeout(600);
  const gap = await scroller.evaluate((node) => {
    const held = node.querySelectorAll("thead th")[2] as HTMLElement;
    const heads = [...node.querySelectorAll("thead th")].slice(2) as HTMLElement[];
    return Math.min(...heads.map((th) => Math.abs(th.offsetLeft - held.offsetLeft - node.scrollLeft)));
  });
  expect(gap).toBeLessThan(2);
});

test("on the Bowl ticket only the team you picked is outlined in gold, and you can switch teams or take the pick back", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead() });
  const row = page.getByRole("dialog", { name: "Bowl Pool" }).locator(".lab-bowl-game").nth(3);   // open, its pick already saved (Miami)
  const cells = row.locator("button.lab-board-cell");
  const outlined = () => cells.evaluateAll((all) => all.map((cell) => parseFloat(getComputedStyle(cell.querySelector(".lab-board-trace")!).borderTopWidth) > 0));
  await expect(cells.first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(outlined).toEqual([true, false]);
  await cells.nth(1).click();   // switch teams
  await expect.poll(outlined).toEqual([false, true]);
  await cells.nth(1).click();   // tapping the pick again takes it back
  await expect.poll(outlined).toEqual([false, false]);
});

test("before a player claims a seat the Bowl Pool's pop-up is the Claim your seat ticket", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead(false) });
  const sheet = page.getByRole("dialog", { name: "Bowl Pool" });
  const claim = sheet.getByRole("region", { name: "Join the Bowl Pool" });
  await expect(claim).toBeVisible({ timeout: 30_000 });
  // The claim ticket carries its own cream card and navy and gold (it once came through see-through over the room, 2026-11-25).
  expect(await claim.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("clubhouse-bowl-claim-phone-390.png", { maxDiffPixels: 40 });
  await sheet.getByRole("button", { name: "CLAIM YOUR SEAT" }).click();
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
  await board.getByRole("button", { name: /4 PICKS TO MAKE/ }).click();
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

test("Forfeit sits inside the ticket, and forfeiting reads the clubhouse again in place (no reload) and lands on the Big Board", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#slate", homeExtra: homeResponse("playoff-wildcard"), scenarios: ["playoff-upcoming", "playoff-forfeited"] });
  const forfeits: unknown[] = [];
  await page.route("**/api/pickem/forfeit", async (route) => { forfeits.push(route.request().postDataJSON()); await route.fulfill({ json: { forfeited: true } }); });
  const ticket = page.getByRole("dialog", { name: "Your ticket" });
  const panel = ticket.locator(".lab-window .forfeit-panel");
  await expect(panel).toBeVisible({ timeout: 30_000 });   // inside the ticket's own housing, not below it
  await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true; });
  for (const step of [/^Forfeit\?$/, /Still want to forfeit/, /I understand/]) await panel.getByRole("button", { name: step }).click();
  await expect.poll(() => forfeits.length).toBe(1);
  await expect(page).toHaveURL(/\/clubhouse#standings$/);
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);   // the same page: no reload
});

test("forfeited, the room's ticket strip and the ticket say so: your score stands, nothing left to pick", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#slate", homeExtra: homeResponse("playoff-viewer-forfeited"), scenarios: ["playoff-forfeited"] });
  const ticket = page.getByRole("dialog", { name: "Your ticket" });
  await expect(ticket.locator(".lab-ticket-raceover")).toHaveText("You forfeited · your score stands", { timeout: 30_000 });
  await expect(ticket.locator(".forfeit-panel")).toHaveCount(0);
  await ticket.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".clubhouse-page .lab-room-ticket")).toContainText("ForfeitedScore stands");
});

test("out of the playoff race, the Big Board says so and there is no ticket", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#standings", homeExtra: homeResponse("playoff-viewer-out"), scenarios: ["playoff-eliminated"] });
  const board = page.getByRole("dialog", { name: "The Big Board" });
  await expect(board.locator(".lab-tote-race")).toContainText("You can no longer catch the leader; your score stands", { timeout: 30_000 });
  await expect(board.locator(".lab-tote-ticket")).toHaveCount(0);
  await expect(board.locator("tr.is-you")).toHaveClass(/is-out/);
});

test("on a desktop the pop-ups sit under the site's bar, the Big Board reads large, and your ticket's games stand two across", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#standings", size: SIZES["desktop-1280"] });
  const board = page.getByRole("dialog", { name: "The Big Board" });
  await expect(board.locator(".lab-tote")).toBeVisible({ timeout: 30_000 });
  const bar = await page.locator("main.clubhouse-page").evaluate((main) => main.getBoundingClientRect().top);   // the room starts under the site's bar
  const sheet = (await board.boundingBox())!;
  expect(sheet.y).toBeGreaterThanOrEqual(bar);
  expect(sheet.width).toBeLessThanOrEqual(760);
  expect(sheet.width).toBeGreaterThan(640);
  // The ticket centred at the foot of the screen.
  const ticket = (await page.locator(".clubhouse-page .lab-room-ticket").boundingBox())!;
  expect(Math.abs(ticket.x + ticket.width / 2 - 640)).toBeLessThanOrEqual(2);
  await page.goto("/clubhouse#slate"); await page.reload();
  const games = page.getByRole("dialog", { name: "Your ticket" }).locator(".lab-window-part > ol > li");
  await expect(games.first()).toBeVisible({ timeout: 30_000 });
  const [first, second] = await Promise.all([games.nth(0).boundingBox(), games.nth(1).boundingBox()]);
  expect(Math.abs(first!.y - second!.y)).toBeLessThanOrEqual(1);   // side by side
  expect(second!.x).toBeGreaterThan(first!.x + first!.width);
  // Only the games and the ticket scroll, so the scroll bar starts at the top of the games, never up beside the switch or the board's header.
  const scroller = await page.getByRole("dialog", { name: "Your ticket" }).evaluate((dialog) => {
    const scrolling = [...dialog.querySelectorAll<HTMLElement>("*")].filter((node) => node.scrollHeight > node.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(node).overflowY));
    return scrolling.map((node) => node.className);
  });
  expect(scroller).toEqual(["lab-window-scroll"]);
});

test("the board's switch: your ticket is always there to look at, even for a week looked back on, and sending it lands back on the Big Board", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#standings", scenarios: ["upcoming-picked", "complete-survivor"] });
  const sheet = page.getByRole("dialog", { name: "The Big Board" });
  const tabs = sheet.getByRole("navigation", { name: "Board" });
  await expect(tabs).toBeVisible({ timeout: 30_000 });
  await tabs.getByRole("button", { name: "Ticket" }).click();
  await expect(page).toHaveURL(/\/clubhouse#slate$/);
  const ticket = page.getByRole("dialog", { name: "Your ticket" });
  await expect(ticket.locator(".lab-window")).toBeVisible();
  // One step back from any tab closes the board.
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // A week looked back on: its ticket is there too, nothing left to change.
  await page.goto("/clubhouse#standings"); await page.reload();
  await sheet.getByLabel("Change week").selectOption({ label: "Week 3 — Final" }, { timeout: 30_000 });
  await tabs.getByRole("button", { name: "Ticket" }).click();
  await expect(ticket.locator(".lab-window header .lab-tote-week span")).toHaveText(/^WEEK 3/);   // the week, which opens the week list (arrows either side flip a week)
  await expect(ticket.locator(".lab-board-cell:not([disabled])")).toHaveCount(0);
});

test("the pool chat wears the Big Board's housing and opens already full, read ahead while the room was up", async ({ page }) => {
  await openClubhouse(page);
  let reads = 0;
  await page.route("**/api/pool-chat**", (route) => { reads += 1; return route.fulfill({ json: { messages: [{ id: "m1", playerName: "Connor", body: "Bills by a million", createdAt: "2026-11-15T18:00:00Z", isDeleted: false, isModerator: false, canDelete: false }] } }); });
  await page.reload();
  await expect.poll(() => reads).toBeGreaterThan(0);   // read ahead, before the chat is opened
  await page.goto("/clubhouse#chat");
  const chat = page.getByRole("dialog", { name: "Pool chat" });
  await expect(chat.locator(".lab-tote.club-chat")).toBeVisible({ timeout: 30_000 });
  await expect(chat.locator(".pool-chat-message")).toContainText("Bills by a million");
  await expect(chat.getByText("Opening chat...")).toHaveCount(0);
});

// The ticket at the foot of the room, through a regular week, playoff rounds and a player out of the race: a place a pick (a place a game in the playoffs,
// always one row), each with its logo and lamp, and the dark stub to press.
for (const [label, home, scenario, keep] of [
  ["week", null, "upcoming-unpicked", 0],
  ["wild-card", "playoff-wildcard", "playoff-mixed-locks", 0],
  ["divisional", "playoff-divisional", "playoff-upcoming", 4],
  ["race-over", "playoff-viewer-out", "playoff-eliminated", 4],
] as const) {
  test(`your ticket at the foot of the room, ${label}`, async ({ page }) => {
    await openClubhouse(page, { ...(home ? { homeExtra: homeResponse(home) } : {}), scenarios: [scenario], ...(keep ? { shapeBoard: (response: BoardRead) => ({ ...response, games: response.games.slice(0, keep) }) } : {}) });
    const ticket = page.locator(".clubhouse-page .lab-room-ticket");
    await expect(ticket).toBeVisible({ timeout: 30_000 });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
    await page.waitForFunction(() => [...document.images].every((image) => image.complete));
    if (label === "race-over") await expect(ticket.locator(".slip-status")).toContainText("Race over");
    const box = (await ticket.boundingBox())!;
    expect(Math.abs(box.y + box.height - 844)).toBeLessThanOrEqual(1);   // flush with the foot of the screen, however tall
    await expect(ticket).toHaveScreenshot(`clubhouse-ticket-${label}-phone-390.png`, { maxDiffPixels: 40 });
  });
}

// The ticket never covers a thing in the room: every name plate stays clear of it, through a regular week and the biggest playoff
// round, on a small phone, a big phone, a laptop and a desktop.
for (const [label, size] of [["phone-375x667", { width: 375, height: 667 }], ["phone-390", SIZES["phone-390"]], ["laptop-1366x768", { width: 1366, height: 768 }], ["desktop-1280", SIZES["desktop-1280"]]] as const) {
  for (const [when, home, scenario] of [["week", null, "upcoming-unpicked"], ["wild-card", "playoff-wildcard", "playoff-upcoming"]] as const) {
    test(`the ticket covers no name plate in the room, ${when} at ${label}`, async ({ page }) => {
      await openClubhouse(page, { size, ...(home ? { homeExtra: homeResponse(home) } : {}), scenarios: [scenario] });
      await expect(page.getByRole("navigation", { name: "Clubhouse rooms" })).toBeVisible({ timeout: 30_000 });
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      const ticket = (await page.locator(".clubhouse-page .lab-room-ticket").boundingBox())!;
      const plates = await page.locator(".lab-room-tag").evaluateAll((tags) => tags.map((tag) => { const box = tag.getBoundingClientRect(); return { name: tag.textContent, left: box.left, right: box.right, top: box.top, bottom: box.bottom }; }));
      for (const plate of plates) {
        const clear = plate.bottom <= ticket.y || plate.right <= ticket.x || plate.left >= ticket.x + ticket.width;
        expect(clear, `${plate.name} is clear of the ticket`).toBe(true);
      }
    });
  }
}

// The room on a phone and a desktop: every tap spot is thumb-sized however small its thing looks, and no two name plates overlap or leave the
// picture. (These held the Lab's sample room until the room went live; the real room is the same RoomScene.)
for (const [label, size] of Object.entries(SIZES)) {
  test(`the room's tap spots are thumb-sized and its name plates never overlap, at ${label}`, async ({ page }) => {
    await openClubhouse(page, { size });
    const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
    await expect(room).toBeVisible({ timeout: 30_000 });
    for (const spot of await room.locator(".lab-room-spot").all()) {
      const box = (await spot.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
    const plates = await room.locator(".lab-room-tag").evaluateAll((tags) => tags.map((tag) => { const box = tag.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; }));
    expect(plates.length).toBeGreaterThanOrEqual(5);
    for (const [index, plate] of plates.entries()) {
      for (const other of plates.slice(index + 1)) expect(plate.right <= other.left || other.right <= plate.left || plate.bottom <= other.top || other.bottom <= plate.top, "plates do not overlap").toBe(true);
    }
  });
}

test("the room's Big Board keeps the leader on its top line and turns a page of standings every 8 seconds", async ({ page }) => {
  await openClubhouse(page);
  const board = page.locator(".lab-room-screen.is-board");
  await expect(board.locator("header")).toContainText("1/2", { timeout: 30_000 });
  const leader = await board.locator(".lab-room-leader").textContent();
  await page.clock.runFor(7_000);
  await expect(board.locator("header")).toContainText("1/2");   // not yet: a page stays up the full 8 seconds
  await page.clock.runFor(1_000);
  await expect(board.locator("header")).toContainText("2/2");
  await expect(board.locator(".lab-room-leader")).toHaveText(leader!);
  await page.clock.runFor(8_000);
  await expect(board.locator("header")).toContainText("1/2");
});

test("the room's games board stands two games wide and shifts up a row every 7 seconds", async ({ page }) => {
  await openClubhouse(page);
  const ticker = page.locator(".lab-ticker");
  await expect(ticker.locator("p").first()).toBeVisible({ timeout: 30_000 });
  await expect(ticker.locator("> div").first().locator("p")).toHaveCount(2);   // two games a row
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const step = () => ticker.evaluate((node) => (node as HTMLElement).style.getPropertyValue("--step"));
  expect(await step()).toBe("0");
  await page.clock.runFor(5_500);
  expect(await step()).toBe("0");   // not yet: a row stays up most of the 7 seconds
  await page.clock.runFor(1_700);
  await expect.poll(step).toBe("1");
});

/** The Bowl Pool two bowl days in: ten bowls final (eight early ones nobody won), Earl and Tyler a win each. */
function bowlReadPlayed() {
  const read = bowlRead();
  read.games[1] = { ...read.games[1], status: "final", away_score: 31, home_score: 20 };
  const early = Array.from({ length: 8 }, (_, i) => ({ ...read.games[0], id: `e${i}`, bowl_name: `Early Bowl ${i + 1}`, kickoff_at: `2026-09-28T${String(12 + i).padStart(2, "0")}:00:00Z` }));
  read.games = [...early, ...read.games];
  read.publicPicks = [
    { playerId: "p1", game_id: "g1", selected_team_id: "a1", result: "loss" }, { playerId: "p2", game_id: "g1", selected_team_id: "h1", result: "win" },
    { playerId: "p1", game_id: "g2", selected_team_id: "a2", result: "win" }, { playerId: "p2", game_id: "g2", selected_team_id: "h2", result: "loss" },
  ];
  read.automaticResults = [];
  return read;
}

test("the chalkboard is a still chalk drawing that opens the Season Snapshot (no title line: the chart has the room); the Bowl Pool joins only once 10 bowls are final", async ({ page }) => {
  await openClubhouse(page, { bowl: bowlRead(), homeExtra: { serverTime: "2026-12-10T18:00:00Z" } });
  const chalk = page.locator(".lab-room-screen.is-chalk");
  await expect(chalk.locator(".chalk-line")).toHaveCount(4, { timeout: 30_000 });
  await expect(chalk).toHaveText("");   // no names, numbers or title on the board
  await page.getByRole("button", { name: "Season Snapshot", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Season Snapshot" });
  await expect(sheet.locator(".season-snapshot-key-row")).toHaveCount(8);
  await expect(sheet.getByRole("group", { name: "Pool shown" })).toHaveCount(0);   // no Bowl side before 10 bowls are final
  await expect(page).toHaveURL(/#snapshot$/);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("clubhouse-snapshot-phone-390.png", { maxDiffPixels: 40 });
});

test("once 10 bowls are final the Season Snapshot switches to the Bowl Pool too, a point a bowl day", async ({ page }) => {
  await openClubhouse(page, { bowl: bowlReadPlayed(), homeExtra: { serverTime: "2026-12-10T18:00:00Z" } });
  await expect(page.locator(".lab-room-screen.is-chalk .chalk-line")).toHaveCount(4, { timeout: 30_000 });
  await page.getByRole("button", { name: "Season Snapshot", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Season Snapshot" });
  await sheet.getByRole("button", { name: "Bowl", exact: true }).click();
  await expect(sheet.locator(".season-snapshot-key-row")).toHaveText([/Earls*1/, /Tylers*1/]);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("clubhouse-snapshot-bowl-phone-390.png", { maxDiffPixels: 40 });
  // The choice is remembered on this device.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Season Snapshot", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Season Snapshot" }).getByRole("button", { name: "Bowl", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("every pop-up has the same pull notch, at the same spot, on a desktop", async ({ page }) => {
  for (const at of ["slate", "standings", "survivor", "bowl", "trophies", "rules", "notifications", "snapshot"]) {
    await openClubhouse(page, { at: `/clubhouse#${at}`, size: SIZES["desktop-1280"], bowl: bowlRead(), homeExtra: { serverTime: "2026-12-10T18:00:00Z" } });
    const handle = page.locator(".cw-sheet[open] .cw-handle");
    await expect(handle).toBeVisible({ timeout: 30_000 });
    // Once the pop-up has finished rising, its notch sits where every other one does, at the same size.
    await expect.poll(async () => {
      await page.clock.runFor(250);
      return handle.evaluate((node) => { const box = node.getBoundingClientRect(); return `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`; });
    }, { message: at, timeout: 15_000 }).toBe("616,104 48x5");
  }
});

test("every pop-up scrolls only its data, under a heading that stands still, on a phone and a desktop", async ({ page }) => {
  const want: Record<string, string> = { slate: "lab-window-scroll", bowl: "lab-window-scroll", trophies: "lab-wall-table", rules: "lab-rules-body" };
  for (const size of [SIZES["phone-390"], SIZES["desktop-1280"]]) for (const [at, scroller] of Object.entries(want)) {
    await openClubhouse(page, { at: `/clubhouse#${at}`, size, bowl: bowlRead() });
    await expect(page.locator(".cw-sheet[open] .cw-handle")).toBeVisible({ timeout: 30_000 });
    // Once the pop-up has risen and its content is in, exactly one thing scrolls: its data.
    await expect.poll(async () => {
      await page.clock.runFor(250);
      const scrolling = await page.evaluate(() => [...document.querySelectorAll(".cw-sheet[open] *")].filter((node) => /(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 2).map((node) => node.className.toString()));
      return scrolling.length === 1 && scrolling[0].includes(scroller) ? "data only" : JSON.stringify(scrolling);
    }, { message: `${at} at ${size.width}px`, timeout: 20_000 }).toBe("data only");
  }
});

test("the top bar holds still when day and night flip and when the switch goes between the clubhouse and the classic site", async ({ page }) => {
  for (const size of [SIZES["desktop-1280"], SIZES["phone-390"]]) {
    await openClubhouse(page, { size });
    await expect(page.locator(".view-switch:visible")).toBeVisible({ timeout: 30_000 });   // the account is read: the bar is whole
    await page.clock.runFor(1_500);
    // Where each thing in the bar is centred (a turning icon keeps its centre), and how tall the tabs are.
    const bar = () => page.evaluate(() => [...document.querySelectorAll(".site-nav-brand, .site-nav-links, .theme-toggle, .theme-toggle-icon, .view-switch, .account-menu")]
      .filter((node) => node.getBoundingClientRect().width > 0)
      .map((node) => { const box = node.getBoundingClientRect(); return `${node.className.toString().split(" ")[0]} ${Math.round(box.x + box.width / 2)},${Math.round(box.y + box.height / 2)}${node.classList.contains("site-nav-links") ? ` h${Math.round(box.height)}` : ""}`; }));
    const start = await bar();
    await page.locator(".theme-toggle:visible").click();
    await page.mouse.move(0, 400);
    await page.clock.runFor(1_000);
    expect(await bar(), `day to night at ${size.width}px`).toEqual(start);
    await page.locator(".view-switch:visible").click();
    await page.waitForURL((url) => !url.pathname.startsWith("/clubhouse"), { timeout: 30_000 });
    await page.mouse.move(0, 400);
    await page.clock.runFor(1_500);
    expect(await bar(), `clubhouse to classic at ${size.width}px`).toEqual(start);
  }
});

test("a refresh pulled down in the clubhouse blinks the lit lamps (never with reduce motion)", async ({ page }) => {
  await openClubhouse(page);
  await expect(page.locator(".lab-lamp.is-in").first()).toBeVisible({ timeout: 30_000 });
  const blinking = () => page.evaluate(() => [...document.querySelectorAll(".clubhouse-page .lab-lamp:not(.is-off)")].some((lamp) => getComputedStyle(lamp).animationName.startsWith("lamp-blink")));
  const pull = () => page.evaluate(() => window.dispatchEvent(new CustomEvent("pickem-pull-refresh", { cancelable: true, detail: { done: null } })));
  expect(await blinking(), "quiet until a refresh").toBe(false);
  await pull();   // with "reduce motion" on, a refresh is still read but nothing blinks
  await page.waitForTimeout(1_500);
  expect(await blinking(), "reduce motion").toBe(false);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await pull();
  await expect.poll(blinking, { intervals: [50], timeout: 15_000 }).toBe(true);
});

for (const [label, size] of [["phone-390", SIZES["phone-390"]], ["desktop-1280", SIZES["desktop-1280"]]] as const) {
  test(`the Trophy Room's plaque shelf has just its title, no extra line, at ${label}`, async ({ page }) => {
    await openClubhouse(page, { size });
    await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "Trophy Room", exact: true }).click();
    const wall = page.getByRole("dialog", { name: "Trophy Room" }).locator(".lab-case.lab-wall");
    await expect(wall.getByRole("region", { name: "Plaques" })).toBeVisible({ timeout: 30_000 });
    await expect(wall.getByRole("heading", { name: "Plaques" })).toHaveCount(0);
    await expect(page.getByText("one for every season")).toHaveCount(0);
    await wall.scrollIntoViewIfNeeded();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
    await expect(wall).toHaveScreenshot(`clubhouse-plaques-${label}.png`, { maxDiffPixels: 40 });
  });
}

test("side by side teams on the games board keep their names level when one side's pickers run to a second line", async ({ page }) => {
  await openClubhouse(page);
  await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "Make your picks", exact: true }).click();
  const row = page.getByRole("dialog", { name: "Your ticket" }).locator("li:has(.lab-board-at)").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  // Give the left side a tall list of pickers (the right side has none): its box grows, the other's stretches to match.
  await row.locator(".lab-board-cell").first().evaluate((cell) => {
    const note = document.createElement("span");
    note.className = "lab-board-final";
    note.innerHTML = `<b>30</b><em>${"SOME LONG NAME · ".repeat(8)}</em>`;
    cell.appendChild(note);
  });
  const tops = await row.locator(".lab-board-team").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
  expect(tops[0]).toBe(tops[1]);
  const heights = await row.locator(".lab-board-cell").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
  expect(heights[0]).toBe(heights[1]);
});

for (const [label, size] of [["phone-390", SIZES["phone-390"]], ["desktop-1280", SIZES["desktop-1280"]]] as const) {
  test(`the Bowl Pool pop-up keeps its top section short so the games get the room, at ${label}`, async ({ page }) => {
    await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead(), size });
    const sheet = page.getByRole("dialog", { name: "Bowl Pool" });
    const ticket = sheet.locator(".lab-bowl-ticket");
    await expect(ticket.locator(".lab-bowl-game").first()).toBeVisible({ timeout: 30_000 });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot(`clubhouse-bowl-top-${label}.png`, { maxDiffPixels: 60 });
    // Where the first game starts, measured from the top of the ticket: the heading, counts, dial and switch above it.
    const above = await ticket.evaluate((node) => Math.round(node.querySelector(".lab-bowl-day")!.getBoundingClientRect().top - node.getBoundingClientRect().top));
    expect(above, "the first game day starts within this many px of the ticket's top").toBeLessThan(size.width < 600 ? 170 : 200);
  });
}


test("a Bowl game's small line says where it is played after the time, on one line that never makes the row taller", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead() });
  const ticket = page.getByRole("dialog", { name: "Bowl Pool" }).locator(".lab-bowl-ticket");
  const line = ticket.locator(".lab-bowl-game", { hasText: "Snoozeville" }).locator(".lab-bowl-name small");
  await expect(line).toContainText(/ · Boise, ID$/, { timeout: 30_000 });
  const withPlace = (await line.boundingBox())!.height;
  const bare = (await ticket.locator(".lab-bowl-game", { hasText: "National Championship" }).locator(".lab-bowl-name small").boundingBox())!.height;
  expect(withPlace).toBeLessThanOrEqual(bare + 1);
});

test("the trophy a champion holds stands beside their name on the Big Board and on the Bowl sheet, with every title on hover", async ({ page }) => {
  await openClubhouse(page, { at: "/clubhouse#standings" });
  const board = page.getByRole("dialog", { name: "The Big Board" });
  await expect(board.locator(".lab-tote-name [aria-label^='Trophy:']").first()).toBeVisible({ timeout: 30_000 });
  await expect(board.locator(".lab-tote-name [aria-label^='Trophy:'] [aria-hidden='true']")).toHaveCount(1);   // only the holder wears the mark
  await openClubhouse(page, { at: "/clubhouse#bowl", bowl: bowlRead() });
  const ticket = page.getByRole("dialog", { name: "Bowl Pool" }).locator(".lab-bowl-ticket");
  await ticket.getByRole("button", { name: "Sheet", exact: true }).click({ timeout: 30_000 });
  const mark = ticket.locator(".lab-bowl-sheet-name [aria-label='Trophy: Bowl Pool Champion 2025']");
  await expect(mark).toHaveCount(1);
  await expect(mark.locator("[aria-hidden='true']")).toHaveText("🏆");
});

test("the sun and the moon sit in the exact middle of the day and night button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openClubhouse(page);
  const toggle = page.locator("button.theme-toggle:visible").first();
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  for (let turn = 0; turn < 2; turn++) {
    await page.waitForTimeout(600);   // let the turn settle
    const box = (await toggle.boundingBox())!;
    const glyph = (await toggle.locator("svg").boundingBox())!;
    expect(Math.abs(glyph.x + glyph.width / 2 - box.x - box.width / 2)).toBeLessThan(1);
    expect(Math.abs(glyph.y + glyph.height / 2 - box.y - box.height / 2)).toBeLessThan(1);
    await toggle.click();
  }
});

