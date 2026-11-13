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

test("Lab Survivor table: a seat's weeks fanned out", async ({ page }) => {
  await openLab(page, "survivor");
  await page.getByRole("button", { name: /^Marge/ }).click();
  const sheet = page.getByRole("dialog", { name: "Marge's weeks" });
  await expect(sheet.locator(".lab-fan li")).toHaveCount(7);   // six wins, then the loss in week 7
  await expect(sheet.locator(".lab-fan li.is-lost")).toHaveCount(1);
  await holdStill(page);
  await expect(sheet).toHaveScreenshot("lab-survivor-seat-sheet-day-phone-390.png", { maxDiffPixels: 12 });
});

test("Lab Survivor table: every fact the list shows is on the table, and the table and the list agree", async ({ page }) => {
  await openLab(page, "survivor");
  await stepTo(page, 3);
  // Week 3, graded: the Bengals (Hank) and Dolphins (Bev) lost and are swept; Gus went out in week 2.
  await expect(page.getByRole("img", { name: "Bengals: Hank, lost" })).toBeVisible();
  await expect(page.locator(".lab-box.is-swept")).toHaveCount(2);
  await expect(page.locator(".lab-seat.is-out")).toHaveCount(3);
  await expect(page.getByText("OUT · WK 2 · DAL")).toBeVisible();
  await expect(page.locator(".lab-felt-count")).toHaveText("7 of 10 alive");
  // Before kickoff: other players' chips are face down on their seats, never on a team; the viewer's own is on the felt; June has not picked.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Before kickoff" }).click();
  await expect(page.locator(".lab-box.has-chips")).toHaveCount(1);
  await expect(page.getByRole("img", { name: /Chiefs: Walt/ })).toBeVisible();
  await expect(page.getByText("NO PICK YET")).toBeVisible();
  await expect(page.locator(".lab-stack-chip.is-face-down")).toHaveCount(7);   // nine still in, less Walt (the viewer) and June (no pick yet)
  await expect(page.locator(".lab-seat.is-out")).toHaveCount(1);   // only Gus: this week's losses have not happened yet
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
  await expect(page.locator(".lab-box")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Week" }).getByRole("button", { name: "Later week" })).toBeDisabled();
});

test("Lab Survivor table: the divisions line up, East to West, AFC beside NFC on a computer", async ({ page }) => {
  await openLab(page, "survivor", { size: SIZES["desktop-1280"] });
  const rows = await page.locator(".lab-conference").evaluateAll((blocks) => blocks.map((block) => [...block.querySelectorAll(".lab-division")].map((row) => ({ name: row.querySelector(".lab-division-name")!.textContent, top: Math.round(row.getBoundingClientRect().top) }))));
  expect(rows[0].map((row) => row.name)).toEqual(["EAST", "NORTH", "SOUTH", "WEST"]);
  expect(rows[1].map((row) => row.name)).toEqual(["EAST", "NORTH", "SOUTH", "WEST"]);
  expect(rows[0].map((row) => row.top)).toEqual(rows[1].map((row) => row.top));
});

// The tote board: the Big Board (everyone's picks, today's Pad columns plus Survivor's chips, and the season standings on its other
// face) and the Window (every pick a player makes, in one place). Each state gets a picture, phone and desktop by day, phone at night.
const TOTE_SHOTS: Array<[string, Array<[string, string]>]> = [
  ["board-before-kickoff", []],
  ["board-game-day", [["Moment", "Game day"]]],
  ["board-graded", [["Moment", "Graded"]]],
  ["board-season", [["Show", "Season standings"]]],
  ["window-picking", [["Board", "The Window"]]],
  ["window-game-day", [["Board", "The Window"], ["Moment", "Game day"]]],
  ["window-out-of-survivor", [["Board", "The Window"], ["Moment", "Out of Survivor"]]],
  ["window-survivor-decided", [["Board", "The Window"], ["Moment", "Survivor decided"]]],
];
for (const [shot, choices] of TOTE_SHOTS) {
  for (const [theme, label] of [["day", "phone-390"], ["day", "desktop-1280"], ["night", "phone-390"]] as const) {
    test(`Lab tote board, ${shot}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "tote", { theme, size: SIZES[label] });
      for (const [group, choice] of choices) await page.getByRole("group", { name: group }).getByRole("button", { name: choice, exact: true }).click();
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      await holdStill(page);
      await expect(page.locator(".lab-tote-room")).toHaveScreenshot(`lab-tote-${shot}-${theme}-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}

test("the tote Pad keeps today's columns, hides other players' picks until kickoff, and lines up every W and L", async ({ page }) => {
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
  // Every W and L in a pick column sits on the same centre line.
  for (const column of [3, 4]) {
    const centres = await pad.locator(`tbody td:nth-child(${column}) .lab-tote-mark`).evaluateAll((marks) => marks.map((mark) => Math.round(mark.getBoundingClientRect().left + mark.getBoundingClientRect().width / 2)));
    expect(centres.length).toBe(10);
    expect(new Set(centres).size).toBe(1);
  }
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

test("the Window takes every pick in one place: two against the spread, the Survivor chip, one ticket, one Submit", async ({ page }) => {
  await openLab(page, "tote");
  await page.getByRole("group", { name: "Board" }).getByRole("button", { name: "The Window" }).click();
  const window = page.locator(".lab-window");
  const pickem = window.getByRole("region", { name: "Pick’em" });
  const survivor = window.getByRole("region", { name: "Survivor" });
  const ticket = window.getByRole("region", { name: "Your ticket" });
  // A pick is framed by a single gilt line.
  await expect(pickem.locator(".lab-board-cell.is-picked")).toHaveCount(2);
  expect(await pickem.locator(".lab-board-cell.is-picked .lab-board-trace").first().evaluate((element) => getComputedStyle(element, "::after").content)).toBe("none");
  await pickem.getByRole("button", { name: "Steelers -2.5" }).click();
  await expect(pickem.locator(".lab-board-cell.is-picked")).toHaveCount(1);
  await pickem.getByRole("button", { name: "Colts -3.5" }).click();
  await expect(pickem.getByRole("button", { name: "Colts -3.5" })).toHaveAttribute("aria-pressed", "true");
  // Survivor: used teams cannot be picked again; one chip at a time.
  await expect(survivor.getByRole("button", { name: "Eagles" })).toBeDisabled();
  await expect(survivor.getByText("USED WK 4")).toBeVisible();
  await survivor.getByRole("button", { name: "Colts" }).click();
  await expect(survivor.getByRole("button", { name: "Colts" })).toHaveAttribute("aria-pressed", "true");
  await expect(survivor.getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(ticket.getByRole("definition")).toHaveText(["IND -3.5", "LAR +3", "IND"]);
  // One Submit for all three; changing a pick afterwards asks for the change to be sent.
  await ticket.getByRole("button", { name: "Submit picks" }).click();
  await expect(ticket.getByRole("button", { name: "Submitted ✓" })).toBeDisabled();
  await survivor.getByRole("button", { name: "Broncos" }).click();
  await expect(ticket.getByRole("button", { name: "Submit changes" })).toBeEnabled();
  // Game day: a game that has kicked off cannot be changed.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Game day" }).click();
  await expect(pickem.getByRole("button", { name: "Browns +2.5" })).toBeDisabled();
  // Out of Survivor: Survivor stays at the Window while the pool goes on, read only.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Out of Survivor" }).click();
  await expect(survivor).toContainText("lost in week 3");
  await expect(survivor.getByRole("button")).toHaveCount(0);
  await expect(ticket.getByRole("term")).toHaveText(["Pick 1", "Pick 2"]);
  // Survivor decided: the pool is over, so it leaves the Window.
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Survivor decided" }).click();
  await expect(survivor).toHaveCount(0);
  await expect(ticket).toContainText("won it");
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
const ROOM_SHOTS: Array<[string, Array<[string, string]>, boolean]> = [
  ["room", [], false],
  ["room-labels", [], true],
  ["room-from-dec-7", [["Time of year", "From Dec 7"]], false],
  ["room-all-in", [["Picks", "All in"], ["Chat", "Nothing new"]], false],
];
const CLUB_SHOTS: Array<[string, string, Array<[string, string]>]> = [
  ["The Big Board", "big-board", []],
  ["Sportsbook", "window", []],
  ["Trophies", "trophies-wall", []],
  ["Trophies", "trophies-crowning", [["Scene", "A champion is crowned"]]],
];
const CLUB_SIZES: Array<[string, string]> = [["day", "phone-390"], ["day", "desktop-1280"], ["night", "phone-390"]];
for (const [shot, choices, labels] of ROOM_SHOTS) {
  for (const [theme, label] of CLUB_SIZES) {
    test(`Lab clubhouse, ${shot}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "clubhouse", { theme, size: SIZES[label as keyof typeof SIZES] });
      for (const [group, choice] of choices) await page.getByRole("group", { name: group }).getByRole("button", { name: choice, exact: true }).click();
      if (labels) await page.getByRole("button", { name: "Show labels" }).click();
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
    ["Sportsbook", "The Window", ".lab-window"], ["The Big Board", "The Big Board", ".lab-tote"], ["Trophies", "Trophy Room", ".lab-wall"],
    ["Banners", "Trophy Room", ".lab-wall"], ["Plaques", "Trophy Room", ".lab-wall"], ["Survivor", "Survivor", ".lab-survivor-room"],
    ["Record book", "Record book", ".lab-stand-in"], ["Pool chat", "Pool chat", ".lab-stand-in"], ["Constitution", "Constitution", ".lab-stand-in"],
    ["The race", "The race", ".lab-stand-in"],
  ];
  // Everything is a comfortable size for a thumb, however small it looks in the picture. ("Show labels" is the one control that isn't a spot.)
  await expect(room.getByRole("button")).toHaveCount(spots.length + 1);
  for (const button of await room.getByRole("button").all()) {
    const box = (await button.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(36);
  }
  for (const spot of await room.locator(".lab-room-spot").all()) {
    const box = (await spot.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  for (const [spot, heading, inside] of spots) {
    await room.getByRole("button", { name: spot, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, level: 3, exact: true })).toBeVisible();
    await expect(page.locator(inside)).toBeVisible();
    await expect(room).toHaveCount(0);
    await page.getByRole("button", { name: "Back to Clubhouse" }).click();
    await expect(room).toBeVisible();
  }
});

test("the clubhouse room: a few labels until asked, the mail sign, the Bowl Pool board from Dec 7, and the plain list of rooms", async ({ page }) => {
  await openLab(page, "clubhouse");
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  // Only the things whose news is worth a glance carry a label; "Show labels" names everything.
  await expect(room.locator(".lab-room-tag")).toHaveCount(3);
  await expect(room.getByRole("button", { name: "The Big Board" })).toContainText("You: T2");
  await expect(room.getByRole("button", { name: "Survivor" })).toContainText("of 10 alive");
  await room.getByRole("button", { name: "Show labels" }).click();
  await expect(room.locator(".lab-room-tag")).toHaveCount(9);
  await room.getByRole("button", { name: "Hide labels" }).click();
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
  await expect(list.getByRole("button")).toHaveText(["The Window", "The Big Board", "Survivor", "Trophy Room", "The race", "Record book", "Constitution", "Pool chat", "Bowl Pool"]);
  await list.getByRole("button", { name: "Constitution" }).click();
  await expect(page.getByRole("heading", { name: "Constitution", level: 3 })).toBeVisible();
});

test("your ticket is pinned to every clubhouse screen, lights a lamp per pick, and opens the Window", async ({ page }) => {
  await openLab(page, "clubhouse");
  const ticket = page.locator(".lab-room-ticket");
  await expect(ticket).toBeVisible();
  await expect(ticket.locator("i.is-lit")).toHaveCount(2);
  await expect(page.locator(".lab-room-spot.is-sportsbook.is-owed")).toHaveCount(1);
  await page.getByRole("group", { name: "Picks" }).getByRole("button", { name: "All in" }).click();
  await expect(ticket.locator("i.is-lit")).toHaveCount(3);
  await expect(page.locator(".lab-room-spot.is-owed")).toHaveCount(0);
  // It stays on screen inside a room, at the bottom of the window even when the room is long.
  await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "Trophies", exact: true }).click();
  await expect(ticket).toBeInViewport();
  await ticket.click();
  await expect(page.getByRole("heading", { name: "The Window", level: 3 })).toBeVisible();
  await expect(ticket).toHaveCount(0);
});

test("the Trophy Room is one tall wall: banners for the pool chosen, the trophies, then a plaque per season", async ({ page }) => {
  await openLab(page, "clubhouse");
  await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "Trophies", exact: true }).click();
  const banners = page.getByRole("region", { name: "Banners" });
  await expect(banners.getByRole("listitem")).toHaveText(["Earl: 2026, 2024", "Walt: 2025, 2023"]);
  await banners.getByRole("group", { name: "Whose banners" }).getByRole("button", { name: "Survivor" }).click();
  await expect(banners.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("region", { name: "Trophies" }).getByRole("img")).toBeVisible();
  await expect(page.locator(".lab-plaque")).toHaveCount(4);
  // Top to bottom, the way you would look at a real wall.
  const tops = await Promise.all(["Banners", "Trophies", "Plaques"].map(async (name) => (await page.getByRole("region", { name }).boundingBox())!.y));
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
});

test("the Trophy Room: a plaque per season naming each pool's champion; a new champion's pennant swings in", async ({ page }) => {
  await openLab(page, "clubhouse");
  await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "Trophies", exact: true }).click();
  await expect(page.getByRole("article", { name: "2025 champions" }).getByRole("definition")).toHaveText(["Walt", "Dottie", "Rosie"]);
  await expect(page.locator(".lab-pennant")).toHaveCount(0);
  await page.getByRole("group", { name: "Scene" }).getByRole("button", { name: "A champion is crowned" }).click();
  await expect(page.getByRole("img", { name: "2026 Pick'em champion: Earl" })).toBeVisible();
});
