import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./session";

// The Workshop: every custom piece on one endless board, full screen. Its settings stay hidden until a piece's tune button is tapped.
const SIZES = { "phone-390": { width: 390, height: 844 }, "desktop-1280": { width: 1280, height: 800 } } as const;

async function openBoard(page: Page, { theme = "day", size = SIZES["desktop-1280"], saved }: { theme?: string; size?: { width: number; height: number }; saved?: string } = {}) {
  await page.setViewportSize(size);
  await signIn(page, theme);
  if (saved !== undefined) await page.addInitScript((value) => window.localStorage.setItem("pickem-workshop", value), saved);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/admin/workshop");
  const board = page.locator(".workshop-board");
  await expect(board.locator(".workshop-tile").first()).toBeVisible({ timeout: 30_000 });
  return board;
}

/** Holds the board still for a picture: fonts and images in, the football on its first frame, the split-flap tiles landed. */
async function holdStill(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; } .football-loader-sheet { animation: none !important; transform: none !important; }" });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.waitForFunction(() => [...document.querySelectorAll(".bowl-score-tile")].every((tile) => tile.getAttribute("data-settled") === "true"), undefined, { timeout: 15_000 });
}

/** The copy of a button nearest the middle of the screen, clear of the controls along the top and bottom edges. */
async function nearestMiddle(page: Page, name: string): Promise<Locator> {
  const buttons = page.getByRole("button", { name, exact: true });
  const view = page.viewportSize()!;
  let best = -1, bestDistance = Infinity;
  for (let index = 0; index < await buttons.count(); index += 1) {
    const box = await buttons.nth(index).boundingBox();
    if (!box) continue;
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    if (x < 0 || x > view.width || y < 70 || y > view.height - 70) continue;
    const distance = Math.hypot(x - view.width / 2, y - view.height / 2);
    if (distance < bestDistance) [best, bestDistance] = [index, distance];
  }
  expect(best, `a "${name}" on screen`).toBeGreaterThanOrEqual(0);
  return buttons.nth(best);
}

const camera = (page: Page) => page.locator(".workshop-world").evaluate((world) => {
  const match = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0px\) scale\(([\d.]+)\)/.exec(world.style.transform);
  return match ? { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) } : null;
});

async function drag(page: Page, from: [number, number], by: [number, number]) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(from[0] + by[0], from[1] + by[1], { steps: 12 });
  await page.waitForTimeout(120);   // a pause before letting go, so this is a drag and not a fling
  await page.mouse.up();
}

for (const theme of ["day", "night"]) {
  for (const [label, size] of Object.entries(SIZES)) {
    test(`Workshop board at rest, ${theme} at ${label}`, async ({ page }) => {
      await openBoard(page, { theme, size });
      await holdStill(page);
      await expect(page).toHaveScreenshot(`workshop-board-${theme}-${label}.png`);
    });

    test(`Workshop with the football's settings open, ${theme} at ${label}`, async ({ page }) => {
      await openBoard(page, { theme, size });
      await (await nearestMiddle(page, "Tune the loading football")).click();
      await expect(page.getByRole("dialog", { name: "Loading football settings" })).toBeVisible();
      await holdStill(page);
      await expect(page).toHaveScreenshot(`workshop-tuning-${theme}-${label}.png`);
    });
  }
}

test("the board moves without end: drag, scroll, keys and zoom, and the screen is always covered", async ({ page }) => {
  const board = await openBoard(page);
  expect(await camera(page)).toEqual({ x: 12, y: 64, zoom: 1 });
  await expect(page.locator(".workshop-hint")).toBeVisible();

  // Far in every direction: wherever it is, every point of the screen is on a tile or the thin gap between two.
  for (const by of [[-900, -600], [-900, -600], [700, 1200], [1200, 300]] as Array<[number, number]>) {
    await drag(page, [640, 400], by);
  }
  await expect(page.locator(".workshop-hint"), "the hint goes once the board has been moved").toHaveCount(0);
  const moved = await camera(page);
  expect(moved).not.toEqual({ x: 12, y: 64, zoom: 1 });
  const uncovered = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll(".workshop-tile")].map((tile) => tile.getBoundingClientRect());
    const misses: string[] = [];
    for (let x = 4; x < window.innerWidth; x += 37) for (let y = 4; y < window.innerHeight; y += 37) {
      if (!tiles.some((box) => x >= box.left - 7 && x <= box.right + 7 && y >= box.top - 7 && y <= box.bottom + 7)) misses.push(`${x},${y}`);
    }
    return misses;
  });
  expect(uncovered).toEqual([]);

  // Scrolling moves it; the arrow keys move it; + zooms in; Home goes back.
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 300);
  await expect.poll(async () => (await camera(page))!.y).toBe(moved!.y - 300);
  await board.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await camera(page))!.x).toBe(moved!.x + 80);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => (await camera(page))!.zoom).toBe(1.25);
  await page.getByRole("button", { name: "Home" }).click();
  expect(await camera(page)).toEqual({ x: 12, y: 64, zoom: 1 });
});

test("a tap plays one copy of a piece; a drag that starts on a piece does not", async ({ page }) => {
  await openBoard(page);
  const stamp = await nearestMiddle(page, "Play the result stamp");
  await expect(stamp.getByLabel("Against the spread: win")).toBeVisible();
  const box = (await stamp.boundingBox())!;
  await drag(page, [box.x + box.width / 2, box.y + box.height / 2], [-60, 0]);
  await expect(stamp.getByLabel("Against the spread: win"), "dragged, not played").toBeVisible();
  await stamp.click();
  await expect(stamp.getByLabel("Against the spread: loss")).toBeVisible();
  // the other copies are untouched
  await expect(page.getByLabel("Against the spread: loss")).toHaveCount(1);
});

test("settings stay hidden until a tune button is tapped; then every control works, and copies share them", async ({ page }) => {
  await openBoard(page);
  await expect(page.locator(".workshop-panel")).toHaveCount(0);
  await expect(page.locator("input[type=range]")).toHaveCount(0);

  // Football: paused on frame 10, the ball's animation is parked at that frame's moment of the turn.
  await (await nearestMiddle(page, "Tune the loading football")).click();
  const panel = page.getByRole("dialog", { name: "Loading football settings" });
  await panel.getByRole("button", { name: "Pause" }).click();
  await panel.getByLabel("Football frame").fill("10");
  await expect(panel.locator("output").first()).toHaveText("10/108");
  const delays = await page.locator(".football-loader-sheet").evaluateAll((sheets) => sheets.map((sheet) => parseFloat(getComputedStyle(sheet).animationDelay)));
  for (const delay of delays) expect(delay).toBeCloseTo(-((108 - 10 + 0.5) / 108) * 1.8, 1);
  await panel.getByRole("button", { name: "Step on" }).click();
  await expect(panel.locator("output").first()).toHaveText("11/108");
  await panel.getByRole("button", { name: "Play" }).click();
  await expect(panel.locator("output").first()).toHaveText("playing");

  // A setting changed shows in the menu's Your settings (and on the menu button); Live values puts it back.
  await panel.locator(".asset-knob", { hasText: "Time per turn" }).locator("input").fill("3");
  await page.getByRole("button", { name: /^Menu/ }).click();
  const yours = page.locator(".workshop-settings pre");
  await expect(yours).toContainText("Time per turn (--football-spin-s): 3s, live 1.8s");
  await expect(page.locator(".workshop-count")).toHaveText("1");
  await panel.getByRole("button", { name: "Live values" }).click();
  await expect(yours).toHaveText("Every setting is at its live value.");
  await expect(page.locator(".workshop-count")).toHaveCount(0);

  // Escape closes the panel; typed words reach every copy of a piece.
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await (await nearestMiddle(page, "Tune the pick highlight")).click();
  await page.getByRole("dialog", { name: "Pick highlight settings" }).getByLabel("Name").fill("Rams");
  for (const stroke of await page.locator(".asset-highlight").all()) await expect(stroke).toContainText("Rams");
  await page.getByRole("button", { name: "Close settings" }).click();
  await (await nearestMiddle(page, "Tune the bowl crest")).click();
  await page.getByRole("dialog", { name: "Bowl crest settings" }).getByLabel("Title").fill("Rose Bowl");
  await expect(page.locator("[data-piece=crest]").first()).toContainText("ROSE BOWL");

  // The chip has every NFL team.
  await (await nearestMiddle(page, "Tune the survivor poker chip")).click();
  await expect(page.getByRole("dialog", { name: "Survivor poker chip settings" }).locator("select option")).toHaveCount(32);
});

test("settings are remembered on this device, and a damaged save falls back to the live values", async ({ page }) => {
  await openBoard(page);
  await (await nearestMiddle(page, "Tune the games remaining tile")).click();
  await page.getByRole("dialog", { name: "Games remaining tile settings" }).locator(".asset-knob", { hasText: "Time per flip" }).locator("input").fill("300");
  await page.reload();
  await expect(page.locator(".workshop-count")).toHaveText("1", { timeout: 30_000 });

  const damaged = await page.context().newPage();
  await openBoard(damaged, { saved: "{\"knobs\":{\"pace\":\"fast\",\"--football-tilt\":9999},\"chip\":{\"team\":\"XYZ\"},\"view\":7" });
  await expect(damaged.locator(".workshop-count")).toHaveCount(0);
  await expect(damaged.locator("[data-piece=chip]").first()).toBeVisible();
});

test("the menu shows names and switches night; Desk goes back to the Commissioner desk", async ({ page }) => {
  await openBoard(page);
  await expect(page.locator(".workshop-label")).toHaveCount(0);
  await page.getByRole("button", { name: /^Menu/ }).click();
  await page.getByLabel("Show names").check();
  await expect(page.locator(".workshop-label").first()).toBeVisible();
  await page.getByLabel("Night").check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  expect(await page.evaluate(() => window.localStorage.getItem("pickem-theme"))).toBe("night");
  await page.getByRole("link", { name: "Desk" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator(".workshop")).toHaveCount(0);
});

test("the Commissioner desk's Workshop tab opens the board full screen", async ({ page }) => {
  await page.setViewportSize(SIZES["desktop-1280"]);
  await signIn(page, "day");
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/admin");
  await page.locator(".commissioner-panel-tab", { hasText: "Workshop" }).click();
  await expect(page).toHaveURL(/\/admin\/workshop$/);
  await expect(page.locator(".workshop-tile").first()).toBeVisible({ timeout: 30_000 });
});

test("the Bowl Card's two split-flap styles are two cards, each tuned on its own", async ({ page }) => {
  await openBoard(page);
  await expect(page.locator("[data-piece=tile] .bowl-score-tile").first()).toBeVisible();
  await expect(page.locator("[data-piece=wins] .bowl-score-tile").first()).toBeVisible();
  await (await nearestMiddle(page, "Tune the player wins tile")).click();
  const wins = page.getByRole("dialog", { name: "Player wins tile settings" });
  await wins.locator(".asset-knob", { hasText: "Time per flip" }).locator("input").fill("250");
  await wins.getByLabel("Player wins").fill("42");
  await expect(page.locator("[data-piece=wins] .bowl-score-tile").first()).toHaveAttribute("data-settled", "true", { timeout: 15_000 });
  for (const tile of await page.locator("[data-piece=wins] .bowl-score-tile").all()) await expect(tile).toHaveAttribute("aria-label", "42 wins");
  for (const tile of await page.locator("[data-piece=tile] .bowl-score-tile").all()) await expect(tile).toHaveAttribute("aria-label", "12 wins");
  await page.getByRole("button", { name: /^Menu/ }).click();
  await expect(page.locator(".workshop-settings pre")).toHaveText("Time per flip (paceWins): 250ms, live 140ms");
});

test("the megaphone rests raised and raises again only when tapped", async ({ page }) => {
  await openBoard(page);
  await expect(page.locator("[data-piece=pennant] .bowl-team-pick.is-new")).toHaveCount(0);
  const megaphone = await nearestMiddle(page, "Play the bowl pool megaphone");
  await megaphone.click();
  await expect(megaphone.locator(".bowl-team-pick.is-new")).toHaveCount(1);
  await expect(page.locator("[data-piece=pennant] .bowl-team-pick.is-new")).toHaveCount(1);
});
