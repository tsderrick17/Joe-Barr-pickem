import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";

// The Workshop Lab's try-outs, with sample data only. Each try-out's states get a picture.
const SIZES = { "phone-390": { width: 390, height: 844 }, "desktop-1280": { width: 1280, height: 800 } } as const;
// A try-out that is live in the clubhouse is pictured there in full (clubhouse.visual.spec.ts); here it keeps one picture a state, by day on a phone.
const LIVE = [["day", "phone-390"]] as const;

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
  await page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Survivor", exact: true }).click();
  await expect(page).toHaveURL(/try=survivor/);
  await page.goto("/admin/workshop/lab");
  await expect(page.locator(".lab-survivor-room")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Survivor", exact: true })).toHaveAttribute("aria-pressed", "true");
});

// Survivor (the pool's own table, from the sample players): each state gets a picture, phone and desktop by day, phone at night.
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
  for (const [theme, label] of LIVE) {
    test(`Lab Survivor table, ${shot}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "survivor", { theme, size: SIZES[label] });
      await stepTo(page, week);
      if (moment) await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: moment }).click();
      await holdStill(page);
      await expect(page.locator(".lab-survivor-room")).toHaveScreenshot(`lab-survivor-${shot}-${theme}-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}

test("Lab Survivor shows the pool's own Survivor table, fed from the sample players, at any week", async ({ page }) => {
  await openLab(page, "survivor");
  const room = page.locator(".lab-survivor-room");
  // The real table: ten players, a team logo for each week used; week 7 graded has three out (Gus, Bev, Marge).
  await expect(room.getByRole("heading", { name: "Survivor Table" })).toBeVisible();
  await expect(room.locator(".survivor-standings-row")).toHaveCount(10);
  await expect(room.locator(".survivor-sticky-status.is-out")).toHaveCount(4);
  // Earlier weeks: fewer out.
  await stepTo(page, 3);
  await expect(room.locator(".survivor-sticky-status.is-out")).toHaveCount(3);
  // The last week: one player left, the champion.
  for (let at = 3; at < 12; at++) await page.getByRole("group", { name: "Week" }).getByRole("button", { name: "Later week" }).click();
  await expect(room.locator(".survivor-sticky-status.is-in")).toHaveCount(1);
});

// Pick'em Pad skins: five materials for one pad. Each skin gets a picture on game day, phone by day and at night; the scratch-off before kickoff too.
const SKIN_NAMES = ["Split-flap", "Scratch-off", "Tote board", "Bowling sheet", "Ballpark"];
for (const skin of SKIN_NAMES) {
  for (const [theme, label] of LIVE) {
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
for (const [label, size] of [["phone-390", SIZES["phone-390"]]] as const) {
  for (const tryOut of ["survivor", "skins"]) {
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


// Game states: the real Big Board and your ticket in every state a week can be in, on sample players. Each state gets a picture, by day on a phone;
// a few also at night and on a desktop.
const GAME_STATES = ["Picks owed", "All in, can still change", "A game under way", "Results coming in", "Week final", "A pick missed", "Playoff round", "Out of the race", "Forfeited"];
for (const name of GAME_STATES) {
  test(`Lab Game states, ${name}, day at phone-390`, async ({ page }) => {
    await openLab(page, "states");
    await page.getByRole("group", { name: "Game state" }).getByRole("button", { name, exact: true }).click();
    await holdStill(page);
    await expect(page.locator(".lab-states")).toHaveScreenshot(`lab-states-${name.toLowerCase().replace(/[^a-z]+/g, "-")}-day-phone-390.png`, { maxDiffPixels: 12 });
  });
}
for (const [name, theme, label] of [["Results coming in", "night", "phone-390"], ["Playoff round", "night", "phone-390"], ["Results coming in", "day", "desktop-1280"], ["Playoff round", "day", "desktop-1280"]] as const) {
  test(`Lab Game states, ${name}, ${theme} at ${label}`, async ({ page }) => {
    await openLab(page, "states", { theme, size: SIZES[label] });
    await page.getByRole("group", { name: "Game state" }).getByRole("button", { name, exact: true }).click();
    await holdStill(page);
    await expect(page.locator(".lab-states")).toHaveScreenshot(`lab-states-${name.toLowerCase().replace(/[^a-z]+/g, "-")}-${theme}-${label}.png`, { maxDiffPixels: 12 });
  });
}

test("Lab Game states changes the board and the ticket together, and steps through every state", async ({ page }) => {
  await openLab(page, "states");
  const states = page.locator(".lab-states");
  await expect(states.locator(".lab-tote")).toBeVisible();
  await expect(states.locator(".lab-room-ticket .slip-stub b")).toHaveText("PICK");   // picks owed
  await expect(states.locator(".lab-tote-ticket b")).toContainText("TO MAKE");
  await states.getByRole("button", { name: "Week final", exact: true }).click();
  await expect(states.locator(".lab-room-ticket .slip-stub b")).toHaveText("VIEW");
  await expect(states.locator(".lab-room-ticket .slip-status")).toContainText("FINAL");
  await expect(states.locator(".lab-tote header span")).toContainText("FINAL");
  await states.getByRole("button", { name: "Playoff round", exact: true }).click();
  await expect(states.locator(".lab-tote table.is-playoff")).toBeVisible();
  // The arrows go state to state: nine in all, no way past either end.
  await states.getByRole("button", { name: "Picks owed", exact: true }).click();
  await expect(states.getByRole("button", { name: "Earlier state" })).toBeDisabled();
  for (let at = 1; at < GAME_STATES.length; at++) await states.getByRole("button", { name: "Next state" }).click();
  await expect(states.getByRole("button", { name: "Next state" })).toBeDisabled();
  await expect(states).toContainText("9 of 9");
});
