import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./session";

// The Workshop showroom: every custom piece once, on shelves, inside the Commissioner area. Its settings stay hidden until a piece's tune button is tapped.
const SIZES = { "phone-390": { width: 390, height: 844 }, "desktop-1280": { width: 1280, height: 800 } } as const;

async function openBoard(page: Page, { theme = "day", size = SIZES["desktop-1280"], saved }: { theme?: string; size?: { width: number; height: number }; saved?: string } = {}) {
  await page.setViewportSize(size);
  await signIn(page, theme);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => window.localStorage.setItem("commissioner-dial-hint", "3"));
  if (saved !== undefined) await page.addInitScript((value) => window.localStorage.setItem("pickem-workshop", value), saved);
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/admin/workshop");
  const board = page.locator(".workshop");
  await expect(board.locator(".workshop-tile").first()).toBeVisible({ timeout: 30_000 });
  return board;
}

/** Holds the page still for a picture: fonts and images in, the football on its first frame, the split-flap tiles landed, the dial at rest. */
async function holdStill(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; } .football-loader-sheet { animation: none !important; transform: none !important; }" });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.waitForFunction(() => [...document.querySelectorAll(".bowl-score-tile")].every((tile) => tile.getAttribute("data-settled") === "true"), undefined, { timeout: 15_000 });
  await expect(page.locator(".cw-shell[data-status=ready]")).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(400);
}

/** A piece's button: each piece is on its shelf once. */
async function nearestMiddle(page: Page, name: string): Promise<Locator> {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toHaveCount(1);
  await button.scrollIntoViewIfNeeded();
  return button;
}

/** Opens Your settings, reads the text, and closes it again. */
async function yourSettings(page: Page) {
  await page.getByRole("button", { name: /^Your settings/ }).click();
  const sheet = page.getByRole("dialog", { name: "Your settings" });
  const text = await sheet.locator(".workshop-settings pre").innerText();
  await sheet.getByRole("button", { name: "Close" }).click();
  return text;
}

for (const theme of ["day", "night"]) {
  for (const [label, size] of Object.entries(SIZES)) {
    test(`Workshop showroom, ${theme} at ${label}`, async ({ page }) => {
      await openBoard(page, { theme, size });
      await holdStill(page);
      await expect(page).toHaveScreenshot(`workshop-showroom-${theme}-${label}.png`, { fullPage: true });
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

test("every piece is on its shelf once, in four shelves", async ({ page }) => {
  await openBoard(page);
  expect(await page.locator(".workshop-shelf > h2").allInnerTexts()).toEqual(["Pick’em", "Bowl Pool", "Around the site", "Trophy banners"]);
  const ids = await page.locator(".workshop-tile").evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute("data-piece")));
  expect(ids).toHaveLength(15);
  expect(new Set(ids).size).toBe(15);
  // A wide piece runs the whole shelf, and nothing spills sideways on a phone.
  await page.setViewportSize(SIZES["phone-390"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("a tap plays the piece", async ({ page }) => {
  await openBoard(page);
  const stamp = await nearestMiddle(page, "Play the result stamp");
  await expect(stamp.getByLabel("Against the spread: win")).toBeVisible();
  await stamp.click();
  await expect(stamp.getByLabel("Against the spread: loss")).toBeVisible();
});

test("settings stay hidden until a tune button is tapped; then every control works", async ({ page }) => {
  await openBoard(page);
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

  // A setting changed shows on the Your settings button and in its text; Live values puts it back.
  await panel.locator(".asset-knob", { hasText: "Time per turn" }).locator("input").fill("3");
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".workshop-count")).toHaveText("1");
  expect(await yourSettings(page)).toContain("Time per turn (--football-spin-s): 3s, live 1.8s");
  await (await nearestMiddle(page, "Tune the loading football")).click();
  await panel.getByRole("button", { name: "Live values" }).click();
  await page.keyboard.press("Escape");   // Escape closes the sheet
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".workshop-count")).toHaveCount(0);
  expect(await yourSettings(page)).toBe("Every setting is at its live value.");

  // Typed words reach the piece.
  await (await nearestMiddle(page, "Tune the pick highlight")).click();
  await page.getByRole("dialog", { name: "Pick highlight settings" }).getByLabel("Name").fill("Rams");
  await expect(page.locator(".asset-highlight").first()).toContainText("Rams");
  await page.getByRole("dialog", { name: "Pick highlight settings" }).getByRole("button", { name: "Close" }).click();
  await (await nearestMiddle(page, "Tune the bowl crest")).click();
  await page.getByRole("dialog", { name: "Bowl crest settings" }).getByLabel("Title").fill("Rose Bowl");
  await expect(page.locator("[data-piece=crest]")).toContainText("ROSE BOWL");
  await page.getByRole("dialog", { name: "Bowl crest settings" }).getByRole("button", { name: "Close" }).click();

  // The chip has every NFL team, as chips (no drop-down).
  await (await nearestMiddle(page, "Tune the survivor poker chip")).click();
  await expect(page.getByRole("dialog", { name: "Survivor poker chip settings" }).getByRole("group", { name: "Team" }).getByRole("button")).toHaveCount(32);
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
  await expect(damaged.locator("[data-piece=chip]")).toBeVisible();
});

test("Show names labels every piece; the dial and the Wheel button lead back", async ({ page }) => {
  await openBoard(page);
  await expect(page.locator(".workshop-label")).toHaveCount(0);
  await page.getByLabel("Show names").check();
  await expect(page.locator(".workshop-label")).toHaveCount(15);
  await page.getByRole("link", { name: "Back to the wheel" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator(".workshop")).toHaveCount(0);
});

test("the wheel's Workshop spoke opens the showroom", async ({ page }) => {
  await page.setViewportSize(SIZES["desktop-1280"]);
  await signIn(page, "day");
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/admin");
  await expect(async () => {
    await page.getByRole("button", { name: /^Workshop:/ }).click();
    await expect(page).toHaveURL(/\/admin\/workshop$/, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.locator(".workshop-tile").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Workshop" })).toBeVisible();
});

test("the Bowl Card's two split-flap styles are two cards, each tuned on its own", async ({ page }) => {
  await openBoard(page);
  await (await nearestMiddle(page, "Tune the player wins tile")).click();
  const wins = page.getByRole("dialog", { name: "Player wins tile settings" });
  await wins.locator(".asset-knob", { hasText: "Time per flip" }).locator("input").fill("250");
  await wins.getByLabel("Player wins").fill("42");
  await expect(page.locator("[data-piece=wins] .bowl-score-tile")).toHaveAttribute("data-settled", "true", { timeout: 15_000 });
  await expect(page.locator("[data-piece=wins] .bowl-score-tile")).toHaveAttribute("aria-label", "42 wins");
  await expect(page.locator("[data-piece=tile] .bowl-score-tile")).toHaveAttribute("aria-label", "12 wins");
  await wins.getByRole("button", { name: "Close" }).click();
  expect(await yourSettings(page)).toBe("Time per flip (paceWins): 250ms, live 140ms");
});

test("the megaphone rests raised and raises again only when tapped", async ({ page }) => {
  await openBoard(page);
  await expect(page.locator("[data-piece=pennant] .bowl-team-pick.is-new")).toHaveCount(0);
  await (await nearestMiddle(page, "Play the bowl pool megaphone")).click();
  await expect(page.locator("[data-piece=pennant] .bowl-team-pick.is-new")).toHaveCount(1);
});

test("the pull-to-refresh strip: slide it by hand, or tap to watch a whole pull", async ({ page }) => {
  await openBoard(page);
  const strip = await nearestMiddle(page, "Play the pull to refresh");
  const scene = () => strip.locator("svg").innerHTML();
  const planted = await scene();
  await (await nearestMiddle(page, "Tune the pull to refresh")).click();
  const panel = page.getByRole("dialog", { name: "Pull to refresh settings" });
  await panel.getByLabel("How far it is pulled").fill("0");
  const slack = await scene();
  expect(slack, "not pulled: the pole is up and the counter still at 4").not.toBe(planted);
  await panel.getByLabel("How far it is pulled").fill("0.3");
  expect(await scene(), "partly pulled: somewhere in between").not.toBe(slack);
  await panel.getByLabel("How far it is pulled").fill("1");
  expect(await scene(), "all the way: as it was").toBe(planted);
  await panel.getByRole("button", { name: "Close" }).click();
  await strip.click();
  await expect.poll(scene, { timeout: 5000 }).not.toBe(planted);
  await expect.poll(scene, { timeout: 8000 }).toBe(planted);
});

test("each trophy banner has its own words and colour: turn the hue, and live puts it back", async ({ page }) => {
  await openBoard(page);
  for (const pool of ["pickem", "bowl", "survivor"]) await expect(page.locator(`[data-piece=banner-${pool}] canvas`).first()).toBeAttached();
  const rafters = page.locator("[data-piece=banner-bowl] .trophy-rafters").first();
  await expect(rafters, "live colours come from the pool's own style, not from the showroom").not.toHaveAttribute("style", /--banner/);
  await (await nearestMiddle(page, "Tune the bowl pool banner")).click();
  const panel = page.getByRole("dialog", { name: "Bowl Pool banner settings" });
  await expect(panel.getByLabel("Title")).toHaveValue("Bowl Pool champion");
  await panel.getByLabel("Name").fill("Rick");
  await panel.getByLabel("Years").fill("2026, 2024, abc");
  await panel.locator(".asset-knob", { hasText: "Turn the hue" }).locator("input").fill("40");
  await expect(rafters).toHaveAttribute("style", /--banner: oklch\(0\.400 0\.140 295\.0\)/);
  await panel.getByRole("button", { name: "Close" }).click();
  expect(await yourSettings(page)).toBe("Turn the hue (bowlHue): 40deg, live 0deg");
  await (await nearestMiddle(page, "Tune the bowl pool banner")).click();
  await panel.getByRole("button", { name: "Live values" }).click();
  await expect(rafters).not.toHaveAttribute("style", /--banner/);
});

test("an animation's easing is a setting: choose one, see it on the piece and in Your settings, and Live values restores it", async ({ page }) => {
  await openBoard(page);
  const stage = page.locator("[data-piece=highlight] .workshop-stage");
  await expect(stage).not.toHaveAttribute("style", /ease/);
  await (await nearestMiddle(page, "Tune the pick highlight")).click();
  const panel = page.getByRole("dialog", { name: "Pick highlight settings" });
  await panel.getByRole("group", { name: "Easing" }).getByRole("button", { name: "Soft" }).click();
  await expect(stage).toHaveAttribute("style", /--selection-sweep-ease: ease-in-out/);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".workshop-count")).toHaveText("1");
  expect(await yourSettings(page)).toBe("Pick highlight easing (--selection-sweep-ease): ease-in-out, live cubic-bezier(.18, .72, .18, 1)");
  await (await nearestMiddle(page, "Tune the pick highlight")).click();
  await panel.getByRole("button", { name: "Live values" }).click();
  await expect(stage).not.toHaveAttribute("style", /ease/);
  await expect(page.locator(".workshop-count")).toHaveCount(0);
});

test("zoom in tile enlarges one piece in the Workshop only, and is not a setting to copy", async ({ page }) => {
  await openBoard(page);
  const stage = page.locator("[data-piece=stamp] .workshop-stage");
  await expect(stage).toHaveAttribute("style", /--asset-zoom: 2\.2/);
  await (await nearestMiddle(page, "Tune the result stamp")).click();
  const panel = page.getByRole("dialog", { name: "Result stamp settings" });
  await panel.getByText("Zoom in tile").locator("..").locator("input").fill("2");
  await expect(stage).toHaveAttribute("style", /--asset-zoom: 4\.4/);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".workshop-count")).toHaveCount(0);
  expect(await yourSettings(page)).toBe("Every setting is at its live value.");
});

test("Play everything plays every piece at once", async ({ page }) => {
  await openBoard(page);
  await expect(page.locator(".bowl-team-pick.is-new")).toHaveCount(0);
  await expect(page.getByLabel("Against the spread: win")).toBeVisible();
  await page.getByRole("button", { name: "Play everything" }).click();
  await expect(page.locator(".bowl-team-pick.is-new").first()).toBeVisible();
  await expect(page.getByLabel("Against the spread: loss")).toBeVisible();
});

test("a damaged save is ignored value by value: bad easing, zoom and pull fall back, good ones stay", async ({ page }) => {
  await openBoard(page, { saved: JSON.stringify({ ease: { highlight: "wobbly", pennant: "soft" }, zoom: { chip: 99, stamp: 1.5 }, pullAt: "far", banners: { bowl: { name: 7, tag: "Bowl Pool champion" } } }) });
  await expect(page.locator("[data-piece=chip] .workshop-stage")).toHaveAttribute("style", /--asset-zoom: 1\.5/);   // 99 is out of range: the live zoom
  await expect(page.locator("[data-piece=stamp] .workshop-stage")).toHaveAttribute("style", /--asset-zoom: 3\.3/);   // 2.2 x 1.5 kept
  await expect(page.locator("[data-piece=highlight] .workshop-stage")).not.toHaveAttribute("style", /ease/);
  await expect(page.locator("[data-piece=pennant] .workshop-stage")).toHaveAttribute("style", /--megaphone-raise-ease: ease-in-out/);
  await expect(page.locator(".workshop-count")).toHaveText("1");
});
