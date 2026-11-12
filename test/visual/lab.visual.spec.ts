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

for (const theme of ["day", "night"]) {
  for (const [label, size] of Object.entries(SIZES)) {
    for (const look of ["Today", "Refined"]) {
      for (const week of ["Saved", "Game day", "Graded"]) {
        if (look === "Today" && week !== "Saved") continue;   // today's look is already covered on the real pages
        test(`Lab ticket and receipt, ${look}, ${week}, ${theme} at ${label}`, async ({ page }) => {
          await openLab(page, "ticket", { theme, size });
          await page.getByRole("group", { name: "Look" }).getByRole("button", { name: look }).click();
          await page.getByRole("group", { name: "Week" }).getByRole("button", { name: week }).click();
          await holdStill(page);
          await expect(page.locator(".lab-family")).toHaveScreenshot(`lab-ticket-${look.toLowerCase()}-${week.toLowerCase().replace(/ /g, "-")}-${theme}-${label}.png`, { maxDiffPixels: 12 });   // the small Survivor chip logo renders a few pixels differently from run to run
        });
      }
    }
  }
}

test("the ticket and receipt try-out switches between today's look and the refined family", async ({ page }) => {
  await openLab(page, "ticket");
  const family = page.locator(".lab-family");
  await expect(family).toHaveAttribute("data-look", "refined");
  await expect(family.getByRole("region", { name: "Your weekly receipt" })).toBeVisible();
  await expect(family.getByRole("region", { name: /Your current ticket/ })).toBeVisible();
  await page.getByRole("group", { name: "Look" }).getByRole("button", { name: "Today" }).click();
  await expect(family).toHaveAttribute("data-look", "today");
  await expect(family).not.toHaveClass(/ticket-family/);
});

test("the Lab remembers the try-out on this device and in the address", async ({ page }) => {
  await openLab(page, "feel");
  await expect(page.locator("[data-haptic-test]")).toBeVisible();
  await page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Ticket & receipt" }).click();
  await expect(page).toHaveURL(/try=ticket/);
  await page.goto("/admin/workshop/lab");
  await expect(page.locator(".lab-family")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Ticket & receipt" })).toHaveAttribute("aria-pressed", "true");
});

for (const theme of ["day", "night"]) {
  for (const [label, size] of Object.entries(SIZES)) {
    for (const week of ["Week 3", "Week 7", "Week 9"]) {
      test(`Lab Survivor table, ${week}, ${theme} at ${label}`, async ({ page }) => {
        await openLab(page, "survivor", { theme, size });
        await page.getByRole("group", { name: "Week" }).getByRole("button", { name: week }).click();
        await holdStill(page);
        await expect(page.locator(".lab-survivor-room")).toHaveScreenshot(`lab-survivor-${week.toLowerCase().replace(/ /g, "-")}-${theme}-${label}.png`, { maxDiffPixels: 12 });
      });
    }
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

test("Lab Survivor table: the felt shows this week's chips, sweeps a losing team, and List shows the same league", async ({ page }) => {
  await openLab(page, "survivor");
  await page.getByRole("group", { name: "Week" }).getByRole("button", { name: "Week 3" }).click();
  await expect(page.getByRole("img", { name: "Bengals: Hank, lost" })).toBeVisible();   // Hank's Bengals lost in week 3
  await expect(page.locator(".lab-box.is-swept")).toHaveCount(2);   // the Bengals and the Dolphins
  await expect(page.locator(".lab-seat.is-out")).toHaveCount(3);   // Gus (week 2), Hank and Bev (week 3)
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "List" }).click();
  await expect(page.locator(".survivor-standings-row")).toHaveCount(10);
  await expect(page.locator(".lab-felt")).toHaveCount(0);
});

// Lamp-lit: the night look as a lounge after dark. A night mode, so by day it changes nothing but a note saying so.
for (const [label, size] of Object.entries(SIZES)) {
  for (const tryOut of ["survivor", "ticket"]) {
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

// The clubhouse: each page as a room. Each room's states get a picture: phone and desktop by day, phone at night.
const CLUB_SHOTS: Array<[string, string, Array<[string, string]>]> = [
  ["Standings", "leaderboard-game-day", []],
  ["Standings", "leaderboard-before-kickoff", [["Moment", "Before kickoff"]]],
  ["Standings", "leaderboard-wild-card-graded", [["Week", "Wild Card"], ["Moment", "Graded"]]],
  ["Standings", "on-the-course-game-day", [["View", "On the course"]]],
  ["The Slate", "board-gilt", []],
  ["The Slate", "board-brass", [["Pick highlight", "Brass inlay"]]],
  ["The Slate", "board-lit", [["Pick highlight", "Lit line"]]],
  ["The Slate", "board-survivor-game-day", [["Moment", "Game day"], ["Pool", "Survivor"]]],
  ["The Slate", "board-survivor-out", [["Moment", "Out of Survivor"], ["Pool", "Survivor"]]],
  ["Trophy Room", "trophies-wall", []],
  ["Trophy Room", "trophies-crowning", [["Scene", "A champion is crowned"]]],
];
const CLUB_SIZES: Array<[string, string]> = [["day", "phone-390"], ["day", "desktop-1280"], ["night", "phone-390"]];
for (const [room, shot, choices] of CLUB_SHOTS) {
  for (const [theme, label] of CLUB_SIZES) {
    test(`Lab clubhouse, ${shot}, ${theme} at ${label}`, async ({ page }) => {
      await openLab(page, "clubhouse", { theme, size: SIZES[label as keyof typeof SIZES] });
      await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: room }).click();
      for (const [group, choice] of choices) await page.getByRole("group", { name: group }).getByRole("button", { name: choice, exact: true }).click();
      await holdStill(page);
      await expect(page.locator(".lab-clubhouse")).toHaveScreenshot(`lab-clubhouse-${shot}-${theme}-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}

test("the clubhouse doors lead to each room, one at a time", async ({ page }) => {
  await openLab(page, "clubhouse");
  const doors = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(doors.getByRole("button")).toHaveCount(3);
  await expect(page.locator(".lab-leaderboard > ol > li")).toHaveCount(10);
  await doors.getByRole("button", { name: "The Slate" }).click();
  await expect(page.locator(".lab-bigboard li")).toHaveCount(4);
  await expect(page.locator(".lab-leaderboard")).toHaveCount(0);
  await doors.getByRole("button", { name: "Trophy Room" }).click();
  await expect(page.locator(".lab-plaque")).toHaveCount(4);
});

test("the leaderboard raises a player's standard, and other players' picks stay hidden until kickoff", async ({ page }) => {
  await openLab(page, "clubhouse");
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Before kickoff" }).click();
  // The viewer's own standard is raised to start, with their picks showing.
  await expect(page.getByRole("figure", { name: "Walt's picks" }).locator("li.is-hidden")).toHaveCount(0);
  await page.getByRole("button", { name: /ROSIE/ }).click();
  const rosie = page.getByRole("figure", { name: "Rosie's picks" });
  await expect(rosie.locator("li.is-hidden")).toHaveCount(2);
  await expect(rosie.getByRole("img", { name: "Survivor pick hidden until kickoff" })).toBeVisible();
  await expect(page.getByRole("figure", { name: "Walt's picks" })).toHaveCount(0);
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Graded" }).click();
  await expect(rosie.locator("li.is-hidden")).toHaveCount(0);
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "On the course" }).click();
  await expect(page.locator(".lab-course .lab-standard")).toHaveCount(10);
});

test("the Slate board: a pick gets its frame; Survivor marks used teams and moves the chip to a free team", async ({ page }) => {
  await openLab(page, "clubhouse");
  await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "The Slate" }).click();
  const board = page.locator(".lab-bigboard");
  await expect(board.locator(".lab-board-cell.is-picked")).toHaveCount(2);
  await board.getByRole("button", { name: "Steelers -2.5" }).click();
  await expect(board.locator(".lab-board-cell.is-picked")).toHaveCount(1);
  await board.getByRole("button", { name: "Colts -3.5" }).click();
  await expect(board.getByRole("button", { name: "Colts -3.5" })).toHaveAttribute("aria-pressed", "true");
  await board.getByRole("group", { name: "Pool" }).getByRole("button", { name: "Survivor" }).click();
  await expect(board.getByRole("button", { name: "Eagles -3" })).toBeDisabled();
  await expect(board.getByText("USED WK 4")).toBeVisible();
  await board.getByRole("button", { name: "Colts -3.5" }).click();
  await expect(board.getByRole("button", { name: "Colts -3.5" })).toHaveAttribute("aria-pressed", "true");
  await expect(board.locator(".lab-board-chip")).toHaveCount(1);
  await page.getByRole("group", { name: "Moment" }).getByRole("button", { name: "Out of Survivor" }).click();
  await expect(board.getByText("SURVIVOR · OUT WK 3")).toBeVisible();
  await expect(board.locator(".lab-board-cell:not(:disabled)")).toHaveCount(0);
});

test("the Trophy Room: engraved plaques with each pool's mark and a star per title; a new champion's pennant swings in", async ({ page }) => {
  await openLab(page, "clubhouse");
  await page.getByRole("navigation", { name: "Clubhouse rooms" }).getByRole("button", { name: "Trophy Room" }).click();
  await expect(page.getByRole("article", { name: "2025 champions" }).getByLabel("2 titles")).toHaveCount(1);
  await expect(page.locator(".lab-pennant")).toHaveCount(0);
  await page.getByRole("group", { name: "Scene" }).getByRole("button", { name: "A champion is crowned" }).click();
  await expect(page.getByRole("img", { name: "2026 Pick'em champion: Earl" })).toBeVisible();
});
