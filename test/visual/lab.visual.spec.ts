import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";

// The Workshop Lab's try-outs, with sample data only. Each try-out's states get a picture.
const SIZES = { "phone-390": { width: 390, height: 844 }, "desktop-1280": { width: 1280, height: 800 } } as const;

async function openLab(page: Page, tryOut: string, { theme = "day", size = SIZES["phone-390"] }: { theme?: string; size?: { width: number; height: number } } = {}) {
  await page.setViewportSize(size);
  await signIn(page, theme);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => window.localStorage.setItem("commissioner-dial-hint", "3"));
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.goto(`/admin/workshop/lab?try=${tryOut}`);
  await expect(page.getByRole("group", { name: "Try-outs" })).toBeVisible({ timeout: 30_000 });
}

async function holdStill(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; } .cw-dial { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.waitForTimeout(300);
}

test("the Lab remembers the try-out on this device and in the address", async ({ page }) => {
  await openLab(page, "feel");
  await expect(page.locator("[data-haptic-test]")).toBeVisible();
  await page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Survivor table" }).click();
  await expect(page).toHaveURL(/try=survivor/);
  await page.goto("/admin/workshop/lab");
  await expect(page.locator(".lab-survivor-room")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Survivor table" })).toHaveAttribute("aria-pressed", "true");
});

// The Survivor table: each state gets a picture, phone and desktop by day, phone at night.
const TABLE_SHOTS: Array<[string, number, string | null]> = [
  ["week-7-graded", 7, null], ["week-7-before-kickoff", 7, "Before kickoff"], ["week-7-game-day", 7, "Game day"],
  ["week-3-graded", 3, null], ["week-12-champion", 12, null], ["playoffs", 13, null],
];
async function stepTo(page: Page, week: number) {
  const stepper = page.getByRole("group", { name: "Week" });
  for (let at = 7; at < week; at++) await stepper.getByRole("button", { name: "Later week" }).click();
  for (let at = 7; at > week; at--) await stepper.getByRole("button", { name: "Earlier week" }).click();
}
for (const [shot, week, moment] of TABLE_SHOTS) {
  for (const [theme, label] of [["day", "phone-390"], ["day", "desktop-1280"], ["night", "phone-390"]] as const) {
    test(`Lab Survivor table, ${shot}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "survivor", { theme, size: SIZES[label] });
      await stepTo(page, week);
      if (moment) await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: moment }).click();
      await holdStill(page);
      await expect(page.locator(".lab-survivor-room")).toHaveScreenshot(`lab-survivor-${shot}-${theme}-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}

test("Lab Survivor table: tap a player for all 32 teams, the used ones dimmed with their week", async ({ page }) => {
  await openLab(page, "survivor");
  // Dottie is still in after week 7: seven used, twenty-five left.
  const seat = page.getByRole("button", { name: "Dottie: teams used and left" });
  await expect(seat).toContainText("Seahawks");
  await expect(seat).toContainText("WON");
  await expect(seat.locator(".lab-seat-used .lab-stack-chip")).toHaveCount(6);   // weeks 1 to 6; this week's team is on the top line
  await expect(seat).toContainText("25 left");
  await seat.click();
  const sheet = page.getByRole("dialog", { name: "Dottie: 7 used, 25 left" });
  await expect(sheet.getByRole("img", { name: /: used in week \d+$/ })).toHaveCount(7);
  await expect(sheet.getByRole("img", { name: /: left$/ })).toHaveCount(25);
  await expect(sheet.getByRole("img", { name: "Lions: used in week 1" })).toContainText("WK 1");
  // The divisions line up, East to West, in both conferences.
  const rows = await sheet.locator(".lab-conference").evaluateAll((blocks) => blocks.map((block) => [...block.querySelectorAll(".lab-division-name")].map((name) => name.textContent)));
  expect(rows).toEqual([["EAST", "NORTH", "SOUTH", "WEST"], ["EAST", "NORTH", "SOUTH", "WEST"]]);
  await holdStill(page);
  await expect(sheet).toHaveScreenshot("lab-survivor-seat-sheet-day-phone-390.png", { maxDiffPixels: 12 });
  await sheet.getByRole("button", { name: "Close" }).click();
  // Marge lost this week with the Texans: her row says so, and has no "left".
  const out = page.getByRole("button", { name: "Marge: teams used and left" });
  await expect(out).toContainText("Texans");
  await expect(out).toContainText("LOST");
  await expect(out).not.toContainText("left");
  await out.click();
  await expect(page.getByRole("dialog", { name: "Marge: 7 used" }).getByRole("img", { name: "Texans: used in week 7, lost" })).toBeVisible();
});

test("Lab Survivor table: one row a player with this week's team, and the table and the list agree", async ({ page }) => {
  await openLab(page, "survivor");
  await stepTo(page, 3);
  const row = (name: string) => page.getByRole("button", { name: `${name}: teams used and left` });
  await expect(page.locator(".lab-seat")).toHaveCount(10);
  // Week 3, graded: each player's team and whether it won; the Bengals (Hank) and Dolphins (Bev) lost; Gus went out in week 2.
  await expect(row("Walt")).toContainText("ChiefsWON");
  await expect(row("Hank")).toContainText("BengalsLOST");
  await expect(row("Bev")).toContainText("DolphinsLOST");
  await expect(row("Gus")).toContainText("Out · week 2");
  await expect(page.locator(".lab-seat.is-out")).toHaveCount(3);
  await expect(page.locator(".lab-felt-count")).toHaveText("7 of 10 alive");
  // Before kickoff: you see your own team; another player's reads "Pick in" and never names the team; June has not picked.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Before kickoff" }).click();
  await expect(row("Walt")).toContainText("Chiefs");
  await expect(row("Rosie")).toContainText("Pick in");
  await expect(row("Rosie")).not.toContainText("Lions");
  await expect(row("June")).toContainText("No pick yet");
  await expect(page.getByText("Pick in", { exact: true })).toHaveCount(7);   // nine still in, less Walt (the viewer) and June (no pick yet)
  await expect(page.getByText(/WON|LOST/)).toHaveCount(0);   // nothing has won or lost yet
  await expect(page.locator(".lab-seat.is-out")).toHaveCount(1);   // only Gus: this week's losses have not happened yet
  // A pick that is in but hidden is not counted as used: Rosie has used two teams and has thirty left.
  await expect(row("Rosie").locator(".lab-seat-used .lab-stack-chip")).toHaveCount(2);
  await expect(row("Rosie")).toContainText("30 left");
  // The list from the same data: the same players out.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Graded" }).click();
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "List" }).click();
  await expect(page.locator(".survivor-standings-row")).toHaveCount(10);
  await expect(page.locator(".lab-felt")).toHaveCount(0);
});

test("Lab Survivor table: the season ends with a champion, and the playoffs clear the felt", async ({ page }) => {
  await openLab(page, "survivor");
  await stepTo(page, 12);
  await expect(page.locator(".lab-felt-count")).toHaveText("Earl wins Survivor");
  await expect(page.locator(".lab-seat.is-champion")).toHaveCount(1);
  await expect(page.getByRole("img", { name: "Champion" })).toBeVisible();
  await page.getByRole("group", { name: "Week" }).getByRole("button", { name: "Later week" }).click();
  await expect(page.getByText("Survivor runs through the regular season. Earl won it in Week 12.")).toBeVisible();
  await expect(page.locator(".lab-seat")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Week" }).getByRole("button", { name: "Later week" })).toBeDisabled();
});

// The tote board: the Big Board (everyone's picks, today's Pad columns plus Survivor's chips, the season standings on its other face)
// and your ticket, opened from your own row. Each state gets a picture, phone and desktop by day, phone at night.
const TOTE_SHOTS: Array<[string, Array<[string, string]>, boolean]> = [
  ["board-before-kickoff", [], false],
  ["board-game-day", [["Moment", "Game day"]], false],
  ["board-graded", [["Moment", "Graded"]], false],
  ["board-season", [["Show", "Season standings"]], false],
  ["board-out-of-survivor", [["Moment", "Out of Survivor"]], false],
  ["board-survivor-decided", [["Moment", "Survivor decided"]], false],
  ["ticket-picking", [], true],
  ["ticket-survivor", [["What to pick", "Survivor"]], true],
  ["ticket-game-day", [["Moment", "Game day"]], true],
  ["ticket-out-of-survivor", [["Moment", "Out of Survivor"]], true],
  ["ticket-survivor-decided", [["Moment", "Survivor decided"]], true],
];
for (const [shot, choices, ticket] of TOTE_SHOTS) {
  for (const [theme, label] of [["day", "phone-390"], ["day", "desktop-1280"], ["night", "phone-390"]] as const) {
    test(`Lab tote board, ${shot}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "tote", { theme, size: SIZES[label] });
      for (const [group, choice] of choices.filter(([group]) => group !== "What to pick")) await page.getByRole("group", { name: group }).getByRole("button", { name: choice, exact: true }).click();
      if (ticket) await page.locator(".lab-tote-ticket").click();
      // The ticket's own switch (Pick 2 or Survivor) is inside the sheet.
      for (const [group, choice] of choices.filter(([group]) => group === "What to pick")) await page.getByRole("group", { name: group }).getByRole("button", { name: new RegExp(`^${choice}`) }).click();
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      await holdStill(page);
      await expect(ticket ? page.getByRole("dialog", { name: "Your ticket" }) : page.locator(".lab-tote-room")).toHaveScreenshot(`lab-tote-${shot}-${theme}-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}

test("the tote Pad keeps today's columns, hides other players' picks until kickoff, and starts a shown pick where a hidden one's dots start", async ({ page }) => {
  await openLab(page, "tote");
  const pad = page.locator(".lab-tote");
  await expect(pad.locator("thead th")).toHaveText(["W", "PLAYER", "PICK 1", "PICK 2", "SURVSurvivor"]);
  await expect(pad.locator("tbody tr")).toHaveCount(10);
  // Before kickoff: two hidden picks for each of nine players (Walt sees his own), and the Survivor picks of the four others still in.
  await expect(pad.getByRole("img", { name: "Pick in, hidden until kickoff", exact: true })).toHaveCount(18);
  await expect(pad.getByRole("img", { name: "Survivor pick in, hidden until kickoff" })).toHaveCount(4);
  await expect(pad.locator("tr.is-you").getByRole("img", { name: /hidden/ })).toHaveCount(0);
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Graded" }).click();
  await expect(pad.getByRole("img", { name: /hidden/ })).toHaveCount(0);
  // Game day has both in a column: every shown pick starts on one left edge, the same edge a hidden pick's three dots start on,
  // and the dots sit centred in their cell. A result is in the type (no letter): said aloud as win or loss.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Game day" }).click();
  for (const column of [3, 4]) {
    const lefts = (selector: string) => pad.locator(`tbody td:nth-child(${column}) ${selector}`).evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().left)));
    const shown = await lefts(".lab-tote-slip"), hidden = await lefts(".lab-tote-cover i:first-child");
    expect(shown.length).toBeGreaterThan(0);
    expect(new Set([...shown, ...hidden]).size).toBe(1);
  }
  const off = await pad.locator(".lab-tote-cover").first().evaluate((cover) => {
    const cell = cover.closest("td")!.getBoundingClientRect(), first = cover.firstElementChild!.getBoundingClientRect(), last = cover.lastElementChild!.getBoundingClientRect();
    return Math.abs((first.left + last.right) / 2 - (cell.left + cell.right) / 2);
  });
  expect(off).toBeLessThanOrEqual(1.5);
  await expect(pad.locator(".lab-tote-slip.is-w").first()).toContainText("win");
  // Survivor is the team's logo, centred in its column whatever the result.
  const logos = await pad.locator(".lab-tote-logo").evaluateAll((nodes) => nodes.map((node) => { const box = node.getBoundingClientRect(), cell = node.closest("td")!.getBoundingClientRect(); return Math.abs((box.left + box.right) / 2 - (cell.left + cell.right) / 2); }));
  expect(logos.length).toBeGreaterThan(1);
  for (const gap of logos) expect(gap).toBeLessThanOrEqual(1.5);
  await expect(pad.getByRole("img", { name: /, Survivor (win|loss)$/ }).first()).toBeVisible();
});

test("the Big Board turns to the season standings with one tap on the board", async ({ page }) => {
  await openLab(page, "tote");
  const board = page.locator(".lab-tote");
  await board.getByRole("group", { name: "Show" }).getByRole("button", { name: "Season standings" }).click();
  await expect(board.locator("thead th")).toHaveText(["POS", "PLAYER", "WINS", "BACK"]);
  await expect(board.locator("tbody tr")).toHaveCount(10);
  await expect(board.locator("tbody tr").first().locator("td")).toHaveText(["1", /\d+/, "—"]);
  await board.getByRole("group", { name: "Show" }).getByRole("button", { name: "This week’s picks" }).click();
  await expect(board.locator("thead th")).toHaveCount(5);
});

test("your row on the Big Board is your ticket: two against the spread and a Survivor team as plain rows, one Submit, and the row shows it", async ({ page }) => {
  await openLab(page, "tote");
  const board = page.locator(".lab-tote");
  const mine = board.locator("tr.is-you");
  // Your row says it is yours, and each of its cells opens the ticket; nobody else's row can be tapped.
  await expect(mine.getByRole("button")).toHaveCount(3);
  await expect(board.locator("tbody tr:not(.is-you)").getByRole("button")).toHaveCount(0);
  await mine.getByRole("button", { name: /^Pick 1: PIT -2\.5/ }).click();
  const sheet = page.getByRole("dialog", { name: "Your ticket" });
  const pickem = sheet.getByRole("region", { name: "Pick’em" });
  const survivor = sheet.getByRole("region", { name: "Survivor" });
  const ticket = sheet.getByRole("region", { name: "Your ticket" });
  // Nothing has changed yet, so there is nothing to send.
  await expect(ticket.getByRole("button", { name: "Submitted ✓" })).toBeDisabled();
  // A pick is framed by a single gilt line.
  await expect(pickem.locator(".lab-board-cell.is-picked")).toHaveCount(2);
  expect(await pickem.locator(".lab-board-cell.is-picked .lab-board-trace").first().evaluate((element) => getComputedStyle(element, "::after").content)).toBe("none");
  await pickem.getByRole("button", { name: "Steelers -2.5" }).click();
  await expect(pickem.locator(".lab-board-cell.is-picked")).toHaveCount(1);
  await pickem.getByRole("button", { name: "Colts -3.5" }).click();
  await expect(pickem.getByRole("button", { name: "Colts -3.5" })).toHaveAttribute("aria-pressed", "true");
  // Survivor is the same plain rows, one per game: used teams say the week and cannot be picked again; one team at a time.
  // One switch says what is being picked, and how many Survivor teams are left.
  const choose = sheet.getByRole("group", { name: "What to pick" });
  await expect(choose.getByRole("button", { name: /^Pick 2/ })).toHaveAttribute("aria-pressed", "true");
  await choose.getByRole("button", { name: /^Survivor/ }).click();
  await expect(choose.getByRole("button", { name: /^Survivor/ })).toContainText("teams left");
  await expect(survivor.getByRole("listitem")).toHaveCount(4);
  await expect(survivor.getByRole("button")).toHaveCount(8);
  await expect(survivor.getByRole("button", { name: "Eagles" })).toBeDisabled();
  await expect(survivor.getByRole("button", { name: "Eagles" })).toContainText("USED WK 4");
  await survivor.getByRole("button", { name: "Colts" }).click();
  await expect(survivor.getByRole("button", { name: "Colts" })).toHaveAttribute("aria-pressed", "true");
  await choose.getByRole("button", { name: /^Pick 2/ }).click();
  await expect(pickem).toBeVisible();
  await expect(survivor).toHaveCount(0);
  await choose.getByRole("button", { name: /^Survivor/ }).click();
  await expect(survivor.getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(ticket.getByRole("definition")).toHaveText(["IND -3.5", "LAR +3", "Colts"]);
  // One Submit for all three: the ticket closes and your row on the board shows what was sent.
  await ticket.getByRole("button", { name: "Submit changes" }).click();
  await expect(sheet).toBeHidden();
  await expect(mine.getByRole("button")).toHaveText([/IND\s*-3\.5/, /LAR\s*\+3/, /.*/]);
  await expect(mine.getByRole("button", { name: /^Survivor: Colts/ })).toBeVisible();
  await expect(board.locator(".lab-tote-ticket")).toContainText("SUBMITTED ✓");
  // Game day: a game that has kicked off cannot be changed.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Game day" }).click();
  await board.locator(".lab-tote-ticket").click();
  await expect(pickem.getByRole("button", { name: "Browns +2.5" })).toBeDisabled();
  await expect(sheet.getByRole("group", { name: "What to pick" })).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  // Graded: the week is over, so the row is no longer a way in.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Graded" }).click();
  await expect(mine.getByRole("button")).toHaveCount(0);
  await expect(board.locator(".lab-tote-ticket")).toHaveCount(0);
  // Out of Survivor: Survivor stays on the ticket while the pool goes on, read only.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Out of Survivor" }).click();
  await expect(board.locator("tr.is-you th")).toContainText("HANK");
  await board.locator(".lab-tote-ticket").click();
  await expect(sheet).toContainText("lost in week 3");
  await expect(sheet.getByRole("group", { name: "What to pick" })).toHaveCount(0);
  await expect(ticket.getByRole("term")).toHaveText(["Pick 1", "Pick 2"]);
  await sheet.getByRole("button", { name: "Close" }).click();
  // Survivor decided: the pool is over, so it leaves the ticket.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Survivor decided" }).click();
  await board.locator(".lab-tote-ticket").click();
  await expect(sheet.getByRole("group", { name: "What to pick" })).toHaveCount(0);
  await expect(ticket).toContainText("won it");
});

test("a pick still owed reads PICK on your row, and sending it fills the row in", async ({ page }) => {
  await openLab(page, "clubhouse");
  await page.locator(".lab-room-ticket").click();
  // The pinned ticket opens the Big Board with the ticket ready.
  await expect(page.getByRole("heading", { name: "The Big Board", level: 3 })).toBeVisible();
  const sheet = page.getByRole("dialog", { name: "Your ticket" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("region", { name: "Your ticket" }).getByRole("definition")).toHaveText(["PIT -2.5", "LAR +3", "—"]);
  await sheet.getByRole("button", { name: "Close" }).click();
  const board = page.locator(".lab-tote");
  await expect(board.getByRole("button", { name: "Survivor: not picked. Open your ticket" })).toHaveText("PICK");
  await expect(board.locator(".lab-tote-ticket")).toContainText("1 PICK OWED");
  await board.getByRole("button", { name: "Survivor: not picked. Open your ticket" }).click();
  await sheet.getByRole("group", { name: "What to pick" }).getByRole("button", { name: /^Survivor/ }).click();
  await sheet.getByRole("region", { name: "Survivor" }).getByRole("button", { name: "Broncos" }).click();
  await sheet.getByRole("button", { name: "Submit changes" }).click();
  await expect(board.getByRole("button", { name: /^Survivor: Broncos/ })).toBeVisible();
  // Back in the room, the ticket's third lamp is lit and the picks wall no longer glows.
  await page.getByRole("button", { name: "Back to Clubhouse" }).click();
  await expect(page.locator(".lab-room-ticket i.is-lit")).toHaveCount(3);
  await expect(page.locator(".lab-room-spot.is-owed")).toHaveCount(0);
});

// Pick'em Pad skins: five materials for one pad. Each skin gets a picture on game day, phone by day and at night; the scratch-off before kickoff too.
const SKIN_NAMES = ["Split-flap", "Scratch-off", "Tote board", "Bowling sheet", "Ballpark"];
for (const skin of SKIN_NAMES) {
  for (const [theme, label] of [["day", "phone-390"], ["day", "desktop-1280"], ["night", "phone-390"]] as const) {
    test(`Lab pad skin, ${skin}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "skins", { theme, size: SIZES[label] });
      await page.getByRole("group", { name: "Skin" }).getByRole("button", { name: skin }).click();
      await holdStill(page);
      await expect(page.locator(".lab-skins-room")).toHaveScreenshot(`lab-skin-${skin.toLowerCase().replace(/[^a-z]+/g, "-")}-${theme}-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}
test("Lab pad skin, Scratch-off before kickoff, day at phone-390", async ({ page }) => {
  await openLab(page, "skins");
  await page.getByRole("group", { name: "Skin" }).getByRole("button", { name: "Scratch-off" }).click();
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Before kickoff" }).click();
  await holdStill(page);
  await expect(page.locator(".lab-skins-room")).toHaveScreenshot("lab-skin-scratch-off-before-kickoff-day-phone-390.png", { maxDiffPixels: 12 });
});

test("every pad skin shows the same standings and picks, and covers another player's pick until kickoff", async ({ page }) => {
  await openLab(page, "skins");
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Before kickoff" }).click();
  for (const skin of SKIN_NAMES) {
    await page.getByRole("group", { name: "Skin" }).getByRole("button", { name: skin }).click();
    const pad = page.locator(".lab-pad");
    await expect(pad.locator("tbody tr")).toHaveCount(10);
    await expect(pad.getByRole("img", { name: "Hidden until kickoff" })).toHaveCount(18);   // two picks for nine players; Walt sees his own
    await expect(pad.locator("tr.is-you .lab-pad-cover")).toHaveCount(0);
  }
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Graded" }).click();
  await expect(page.locator(".lab-pad").getByRole("img", { name: "Hidden until kickoff" })).toHaveCount(0);
  await expect(page.locator(".lab-pad-mark")).toHaveCount(20);
});

// Lamp-lit: the night look as a lounge after dark. A night mode, so by day it changes nothing but a note saying so.
for (const [label, size] of Object.entries(SIZES)) {
  for (const tryOut of ["survivor", "clubhouse", "skins"]) {
    test(`Lab lamp-lit ${tryOut}, night at ${label}`, async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem("pickem-lab-lamp", "on"));
      await openLab(page, tryOut, { theme: "night", size });
      await expect(page.locator(".lab-stage.is-lamp")).toBeVisible();
      await expect(page.locator(".lab-lamp-note")).toBeHidden();
      await holdStill(page);
      await expect(page.locator(".lab-stage")).toHaveScreenshot(`lab-lamp-${tryOut}-night-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}

test("Lamp-lit is remembered, and by day it only shows a note", async ({ page }) => {
  await openLab(page, "survivor");
  const lamp = page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Lamp-lit" });
  await expect(lamp).toHaveAttribute("aria-pressed", "false");
  await lamp.click();
  await expect(page.getByText("Lamp-lit shows in night mode")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Lamp-lit" })).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
});

// The clubhouse: one 3D room (a picture by day and at night) with a tap spot over each thing in it, and a room behind each spot. The
// room's states and each room get a picture: phone and desktop by day, phone at night.
const ROOM_SHOTS: Array<[string, Array<[string, string]>]> = [
  ["room", []],
  ["room-from-dec-7", [["Time of year", "From Dec 7"]]],
  ["room-all-in", [["Picks", "All in"], ["Chat", "Nothing new"]]],
];
const CLUB_SHOTS: Array<[string, string, Array<[string, string]>]> = [
  ["The Big Board", "big-board", []],
  ["Trophy Room", "trophy-room", []],
  ["Trophy Room", "trophy-room-crowning", [["Scene", "A champion is crowned"]]],
];
const CLUB_SIZES: Array<[string, string]> = [["day", "phone-390"], ["day", "desktop-1280"], ["night", "phone-390"]];
for (const [shot, choices] of ROOM_SHOTS) {
  for (const [theme, label] of CLUB_SIZES) {
    test(`Lab clubhouse, ${shot}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "clubhouse", { theme, size: SIZES[label as keyof typeof SIZES] });
      for (const [group, choice] of choices) await page.getByRole("group", { name: group }).getByRole("button", { name: choice, exact: true }).click();
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      await holdStill(page);
      await expect(page.locator(".lab-clubhouse")).toHaveScreenshot(`lab-clubhouse-${shot}-${theme}-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}
for (const [spot, shot, choices] of CLUB_SHOTS) {
  for (const [theme, label] of CLUB_SIZES) {
    test(`Lab clubhouse, ${shot}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "clubhouse", { theme, size: SIZES[label as keyof typeof SIZES] });
      await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: spot, exact: true }).click();
      for (const [group, choice] of choices) await page.getByRole("group", { name: group }).getByRole("button", { name: choice, exact: true }).click();
      if (spot === "Trophy Room") await expect(page.locator(".trophy-turn-stage")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });   // every picture of the table has arrived
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      await holdStill(page);
      await expect(page.locator(".lab-clubhouse")).toHaveScreenshot(`lab-clubhouse-${shot}-${theme}-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}

test("the clubhouse room: everything in it opens its room in one tap, every spot is thumb-sized, and every room has one way back", async ({ page }) => {
  await openLab(page, "clubhouse");
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  // The whole room is one picture that fits the phone's width: nothing to pan or swipe.
  expect((await room.boundingBox())!.width).toBeLessThanOrEqual(390);
  const spots: Array<[string, string, string]> = [
    ["Make your picks", "The Big Board", ".lab-window"], ["The Big Board", "The Big Board", ".lab-tote"], ["Trophy Room", "Trophy Room", ".trophy-display"],
    ["Survivor", "Survivor", ".lab-survivor-room"], ["Pool chat", "Pool chat", ".lab-stand-in"], ["Constitution", "Constitution", ".lab-stand-in"],
  ];
  // Everything is a comfortable size for a thumb, however small it looks in the picture, and every spot wears its name plate.
  await expect(room.getByRole("button")).toHaveCount(spots.length);
  await expect(room.locator(".lab-room-tag")).toHaveCount(spots.length);
  for (const spot of await room.locator(".lab-room-spot").all()) {
    const box = (await spot.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  for (const [spot, heading, inside] of spots) {
    await room.getByRole("button", { name: spot, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, level: 3, exact: true })).toBeVisible();
    await expect(page.locator(inside)).toBeVisible();
    await expect(room).toHaveCount(0);
    // The picks wall opens the Big Board with the ticket ready; the Big Board itself opens it shut.
    const sheet = page.getByRole("dialog", { name: "Your ticket" });
    if (spot === "Make your picks") await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await page.getByRole("button", { name: "Back to Clubhouse" }).click();
    await expect(room).toBeVisible();
  }
});

test("the clubhouse room: a name plate on everything, the mail sign, the Bowl Pool board from Dec 7, and the plain list of rooms", async ({ page }) => {
  await openLab(page, "clubhouse");
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  // Everything that can be tapped wears a name plate with an arrow, and no two plates overlap; the ones with news carry a line of it.
  await expect(room.locator(".lab-room-tag")).toHaveText(["Survivor›5 of 10 still in · You’re in", "Your picks›1 owed", "Trophies›", /^The Big Board›Earl leads · You: T2$/, "Chat›✉", "Rules›"]);
  const plates = await room.locator(".lab-room-tag").evaluateAll((tags) => tags.map((tag) => { const box = tag.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; }));
  for (const [index, plate] of plates.entries()) {
    expect(plate.left).toBeGreaterThanOrEqual(0);
    expect(plate.right).toBeLessThanOrEqual(390);
    for (const other of plates.slice(index + 1)) expect(plate.right <= other.left || other.right <= plate.left || plate.bottom <= other.top || other.bottom <= plate.top, "name plates do not overlap").toBe(true);
  }
  await expect(room.getByRole("button", { name: "The Big Board" })).toContainText("You: T2");
  await expect(room.getByRole("button", { name: "Survivor" })).toContainText("5 of 10 still in · You’re in");
  // The boards in the room show today's news themselves: the leader always on the top line, then the rest of the standings a page at
  // a time (nine players: a page of five, then four), and the lines running across the spreads board like a ticker, your own picks lit.
  const board = page.locator(".lab-room-screen.is-board");
  await expect(board.locator(".lab-room-leader")).toHaveText("LEADEREarl15");
  await expect(board.locator("li")).toHaveCount(5);
  await expect(board.locator("header")).toContainText("1/2");
  await expect(board.locator("li").first()).toContainText("Dottie");
  await expect(board.locator("li").nth(1)).toHaveText("T2Walt13");   // the board does not mark whose row it is
  await expect(page.locator(".lab-ticker .is-picked")).toHaveText([/PIT[\s\S]*YOURS/, /LAR[\s\S]*YOURS/, /PIT[\s\S]*YOURS/, /LAR[\s\S]*YOURS/]);
  // The laptop on the bar shows a mail sign only when there's a new message.
  await expect(room.getByRole("img", { name: "New message" })).toBeVisible();
  await page.getByRole("group", { name: "Chat" }).getByRole("button", { name: "Nothing new" }).click();
  await expect(room.getByRole("img", { name: "New message" })).toHaveCount(0);
  // The Bowl Pool's bulletin board is wheeled in on Dec 7, and not before.
  await expect(room.getByRole("button", { name: "Bowl Pool" })).toHaveCount(0);
  await page.getByRole("group", { name: "Time of year" }).getByRole("button", { name: "From Dec 7" }).click();
  await expect(room.getByRole("button", { name: "Bowl Pool" })).toBeVisible();
  // The same rooms as a plain list, for anyone who would rather tap a word.
  const list = page.getByRole("group", { name: "Rooms" });
  await expect(list.getByRole("button")).toHaveText(["The Big Board", "Survivor", "Trophy Room", "Constitution", "Pool chat", "Bowl Pool"]);
  await list.getByRole("button", { name: "Constitution" }).click();
  await expect(page.getByRole("heading", { name: "Constitution", level: 3 })).toBeVisible();
});

test("your ticket is pinned to every clubhouse screen, lights a lamp per pick, and opens the Big Board with the ticket ready", async ({ page }) => {
  await openLab(page, "clubhouse");
  const ticket = page.locator(".lab-room-ticket");
  await expect(ticket).toBeVisible();
  await expect(ticket.locator("i.is-lit")).toHaveCount(2);
  await expect(page.locator(".lab-room-spot.is-sportsbook.is-owed")).toHaveCount(1);
  await page.getByRole("group", { name: "Picks" }).getByRole("button", { name: "All in" }).click();
  await expect(ticket.locator("i.is-lit")).toHaveCount(3);
  await expect(page.locator(".lab-room-spot.is-owed")).toHaveCount(0);
  // It stays on screen inside a room, at the bottom of the window even when the room is long.
  await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "Trophy Room", exact: true }).click();
  await expect(ticket).toBeInViewport();
  await ticket.click();
  await expect(page.getByRole("heading", { name: "The Big Board", level: 3 })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Your ticket" })).toBeVisible();
});

test("the Trophy Room: the turning table and banners as today, the records, and the season plaques under them", async ({ page }) => {
  await openLab(page, "clubhouse");
  await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "Trophy Room", exact: true }).click();
  const table = page.locator(".trophy-display");
  await expect(table.locator(".trophy-turn-stage")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  const front = table.getByRole("status").filter({ hasText: "at the front" });
  await expect(front).toHaveText("Pick’em is at the front");
  // One banner per champion, in the order they first won, each carrying every year they have won.
  await expect(table.locator(".trophy-banner")).toHaveText([/Walt[\s\S]*2023[\s\S]*2025/, /Earl[\s\S]*2024[\s\S]*2026/]);
  await table.getByRole("button", { name: "Bring the next trophy forward" }).click();
  await expect(front).toHaveText("Bowl Pool is at the front");
  await expect(table.locator(".trophy-banner")).toHaveCount(4);
  // Under the banners: the plaques, then the records.
  await expect(page.locator(".lab-plaque")).toHaveCount(4);
  const records = page.getByRole("region", { name: "Records" });
  await expect(records.locator("tbody tr")).toHaveCount(10);
  await expect(records.locator("tbody tr").first()).toContainText("Earl");
});

test("the plaques in the Trophy Room: a plaque per season naming each pool's champion; a new champion's pennant swings in", async ({ page }) => {
  await openLab(page, "clubhouse");
  await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "Trophy Room", exact: true }).click();
  await expect(page.locator(".lab-plaque")).toHaveCount(4);
  await expect(page.getByRole("article", { name: "2025 champions" }).getByRole("definition")).toHaveText(["Walt", "Dottie", "Rosie"]);
  await expect(page.locator(".lab-pennant")).toHaveCount(0);
  await page.getByRole("group", { name: "Scene" }).getByRole("button", { name: "A champion is crowned" }).click();
  await expect(page.getByRole("img", { name: "2026 Pick'em champion: Earl" })).toBeVisible();
});

// The horse race: each state gets a picture (phone and desktop by day, phone at night), and the replay is checked as it runs.
const RACE_SHOTS: Array<[string, string]> = [["week-9", "Week 9"], ["week-18", "Week 18"], ["playoffs", "Playoffs"], ["decided", "Decided"]];
for (const [shot, moment] of RACE_SHOTS) {
  for (const [theme, label] of [["day", "phone-390"], ["day", "desktop-1280"], ["night", "phone-390"]] as const) {
    test(`Lab Horse race, ${shot}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "race", { theme, size: SIZES[label] });
      await page.getByRole("group", { name: "Where we are" }).getByRole("button", { name: moment }).click();
      await holdStill(page);
      await expect(page.locator(".lab-race-room")).toHaveScreenshot(`lab-race-${shot}-${theme}-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}

async function horseLefts(page: Page) {
  return page.locator(".lab-race-track .lab-horse").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().right)));
}

test("Lab Horse race: still until run; running winds every horse back to the gate, then runs the season to where it is now", async ({ page }) => {
  await openLab(page, "race");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const rest = await horseLefts(page);
  await page.waitForTimeout(500);
  expect(await horseLefts(page)).toEqual(rest);
  const run = page.getByRole("button", { name: "Run the race" });
  await run.click();
  await expect(page.getByRole("button", { name: "Running…" })).toBeDisabled();
  // Back at the gate first: every horse sits at the start, well behind where it was.
  await expect(page.locator(".lab-race-headline")).toHaveText("Back at the gate");
  await expect.poll(async () => Math.max(...(await horseLefts(page)).map((right, lane) => rest[lane] - right)), { timeout: 5_000 }).toBeGreaterThan(40);
  // Then the weeks go by, one after another, and the race ends exactly where it started.
  await expect(page.locator(".lab-race-headline")).toHaveText(/^Week \d+$/, { timeout: 5_000 });
  await expect(run).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(1_300);
  expect(await horseLefts(page)).toEqual(rest);
  await expect(page.locator(".lab-race-headline")).toHaveText("Earl leads by 1 · You: T2");
});

test("Lab Horse race: the pool decided, the leader at the finish pole and the rest pulled up; nobody leaves the track on a small phone", async ({ page }) => {
  await openLab(page, "race", { size: { width: 360, height: 740 } });
  await page.getByRole("group", { name: "Where we are" }).getByRole("button", { name: "Decided" }).click();
  await expect(page.locator(".lab-race-headline")).toHaveText("Earl wins the pool after Conference Sunday");
  const field = page.getByRole("list", { name: "The field" });
  await expect(field.getByRole("listitem", { name: "Earl, 29 wins" })).toBeVisible();
  await expect(field.getByRole("listitem", { name: /, pulled up$/ })).toHaveCount(9);
  const box = (await field.boundingBox())!;
  const rights = await horseLefts(page);
  const lefts = await page.locator(".lab-race-track .lab-horse").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().left)));
  const finish = box.x + box.width; // the red and white pole stands at 94% of the track beside the lane names
  expect(rights[0]).toBeGreaterThan(rights[1]);
  for (const right of rights) expect(right).toBeLessThanOrEqual(finish);
  for (const left of lefts) expect(left).toBeGreaterThanOrEqual(box.x + 86 - 1);
  await page.getByRole("group", { name: "Where we are" }).getByRole("button", { name: "Playoffs" }).click();
  await expect(field.getByRole("listitem", { name: /pulled up$/ })).toHaveCount(6);
  await expect(page.locator(".lab-race-headline")).toHaveText("Earl leads by 3 · You: 3");
});

test("the room's labels are the buttons: tapping a label opens its room, and the chat's walks you up to the laptop first", async ({ page }) => {
  await openLab(page, "clubhouse");
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  // The label itself takes the tap (it used to let it through to whatever was behind it).
  await room.locator(".lab-room-spot.is-trophies .lab-room-tag").click();
  await expect(page.getByRole("heading", { name: "Trophy Room", level: 3 })).toBeVisible();
  await page.getByRole("button", { name: "Back to Clubhouse" }).click();
  // The new-message sign rides on the Chat label.
  await expect(room.locator(".lab-room-spot.is-chat .lab-room-tag").getByRole("img", { name: "New message" })).toBeVisible();
  // With motion allowed, the chat label zooms the picture in on the laptop, then the chat opens.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await room.locator(".lab-room-spot.is-chat .lab-room-tag").click();
  await expect(room.locator(".lab-room-view.is-zooming")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pool chat", level: 3 })).toBeVisible();
});

test("the room's Big Board keeps the leader on top and turns a page of standings every 15 seconds, and the spreads run across like a ticker that holds still for reduced motion", async ({ page }) => {
  await page.clock.install();
  await openLab(page, "clubhouse");
  const board = page.locator(".lab-room-screen.is-board");
  await expect(board.locator("li").first()).toContainText("Dottie");
  // Not yet: the first page stays up for the full 15 seconds.
  await page.clock.runFor(14_000);
  await expect(board.locator("header")).toContainText("1/2");
  // Then the next page, then back to the first; the leader stays on the top line throughout.
  await page.clock.runFor(1_000);
  await expect(board.locator("header")).toContainText("2/2");
  await expect(board.locator("li")).toHaveCount(4);
  await expect(board.locator("li").last()).toContainText("Gus");
  await expect(board.locator(".lab-room-leader")).toContainText("Earl");
  await page.clock.runFor(15_000);
  await expect(board.locator("li").first()).toContainText("Dottie");
  // The ticker: still for reduced motion, otherwise only ever one way.
  await page.clock.resume();
  const offset = () => page.locator(".lab-ticker").evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41);
  const still = await offset();
  await page.waitForTimeout(800);
  expect(await offset()).toEqual(still);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const first = await offset();
  await page.waitForTimeout(1_200);
  expect(await offset()).toBeLessThan(first);
});
