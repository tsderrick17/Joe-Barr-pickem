import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
import { homeResponse, seasonSnapshotResponse, withElevenPlayers } from "./standings-fixtures.mjs";

// Behavior of the Season Snapshot (the back of the Pick'em Pad), driven in a real browser against fixtures.
// These replace tests that matched the component's source text; no screenshots are compared here.

const SCENARIO = "commissioner-playoff";


/** The fixture snapshot, stretched to nine regular weeks (or more) so the six-week window has something to scroll. */
function nineWeekSnapshot(weekCount = 9) {
  const base = seasonSnapshotResponse(SCENARIO);
  const template = base.regular[base.regular.length - 1];
  const regular = Array.from({ length: weekCount }, (_, week) => ({
    id: `week-${week + 1}`, label: `Week ${week + 1}`, complete: true,
    scores: template.scores.map((score: { playerId: string; wins: number }, index: number) => ({ playerId: score.playerId, wins: Math.max(0, Math.round((week + 1) * (1.8 - index * 0.12))) })),
  }));
  return { ...base, regular };
}

async function open(page: Page, snapshot = nineWeekSnapshot(), home = homeResponse(SCENARIO)) {
  const requests = { snapshot: 0 };
  await signIn(page);
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: home }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/bowl-pool**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/season-snapshot**", (route) => { requests.snapshot += 1; return route.fulfill({ json: snapshot }); });
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".my-ticket")).toBeVisible({ timeout: 30_000 });
  return requests;
}

const flipButton = (page: Page) => page.getByRole("button", { name: "Show the Season Snapshot" });
const backButton = (page: Page) => page.getByRole("button", { name: "Show the Pick'em Pad" });
const keyRows = (page: Page) => page.locator(".season-snapshot-key-row");
const ribbonFills = (page: Page) => page.evaluate(() => [...document.querySelectorAll(".season-snapshot-ribbon > path:first-child")].map((path) => path.getAttribute("fill")));
// The numbers and where they sit: a rescale can keep the same numbers and only spread them out.
const axisScale = (page: Page) => page.evaluate(() => [...document.querySelectorAll(".season-snapshot-yaxis text:not(.season-snapshot-axis-label)")].map((text) => `${text.textContent}@${Math.round(Number(text.getAttribute("y")))}`));

test("the snapshot loads only when the pad is turned over, and only once", async ({ page }) => {
  const requests = await open(page);
  expect(requests.snapshot).toBe(0);
  await flipButton(page).click();
  await expect(page.locator(".season-snapshot-chart")).toBeVisible();
  expect(requests.snapshot).toBe(1);
  await backButton(page).click();
  await flipButton(page).click();
  await expect(page.locator(".season-snapshot-chart")).toBeVisible();
  expect(requests.snapshot, "turning the pad back and forth costs no more requests").toBe(1);
});

test("once the playoffs begin there is a Season | Playoffs switch, and the week range belongs to Season only", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  const half = page.getByRole("group", { name: "Season half shown" });
  await expect(half.getByRole("button", { name: "Playoffs" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Weeks shown" })).toHaveCount(0);
  await half.getByRole("button", { name: "Season" }).click();
  await expect(half.getByRole("button", { name: "Season" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Weeks shown" })).toBeVisible();
});

test("6 Wk windows the chart to six weeks that scroll; All fits the whole season", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  const plot = page.locator(".season-snapshot-plot-scroll");
  await expect(plot).not.toHaveClass(/is-windowed/);
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
  await expect(plot).toHaveClass(/is-windowed/);
  // Nine weeks in a six-week window: the track is wider than what is visible, and it opens on the latest weeks.
  const sizes = await plot.evaluate((element) => ({ visible: element.clientWidth, track: element.scrollWidth, left: element.scrollLeft }));
  expect(sizes.track).toBeGreaterThan(sizes.visible);
  expect(sizes.left).toBeGreaterThan(0);
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "All" }).click();
  await expect(plot).not.toHaveClass(/is-windowed/);
});

test("in the 6 Wk view a rail along the top of the chart shows the window and moves it; All has no rail", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  const weeks = page.getByRole("group", { name: "Weeks shown" });
  await expect(page.locator(".season-snapshot-rail")).toHaveCount(0);
  await weeks.getByRole("button", { name: "6 Wk" }).click();
  const plot = page.locator(".season-snapshot-plot-scroll");
  const track = page.locator(".season-snapshot-rail-track");
  const thumb = page.locator(".season-snapshot-rail-thumb");
  const scrollLeft = () => plot.evaluate((element) => element.scrollLeft);
  const boxes = async () => ({ track: (await track.boundingBox())!, thumb: (await thumb.boundingBox())! });

  // It opens on the latest six of nine weeks: the thumb is two thirds of the track, at its right end.
  let { track: bar, thumb: grip } = await boxes();
  // The rail lies in the strip above the axis's top line (always a numbered tick), above every line.
  const plotBox = (await plot.boundingBox())!;
  expect(bar.y - plotBox.y).toBeLessThan(4);
  const lineTop = await page.locator(".season-snapshot-lines").evaluate((element) => element.getBoundingClientRect().top);
  expect(lineTop, "the highest line stays below the rail").toBeGreaterThan(bar.y + bar.height);
  const topLine = await page.locator(".season-snapshot-plot-scroll line.season-snapshot-tick:not(.is-leaving)").evaluateAll((lines) => Math.min(...lines.map((line) => line.getBoundingClientRect().top)));
  expect(topLine, "the rail sits above the top line, not on it").toBeGreaterThanOrEqual(bar.y + bar.height);
  const topNumber = await page.locator(".season-snapshot-yaxis .season-snapshot-tick:not(.is-leaving)").evaluateAll((texts) => Math.min(...texts.map((text) => text.getBoundingClientRect().top + text.getBoundingClientRect().height / 2)));
  expect(Math.abs(topNumber - topLine), "and the top line has its number").toBeLessThan(4);
  // It is as wide as the grid lines: from the axis to where the lines end, never past them.
  const grid = await page.locator(".season-snapshot-plot-scroll line.season-snapshot-tick:not(.is-leaving)").first().boundingBox();
  expect(bar.x).toBeCloseTo(plotBox.x, 0);
  expect(bar.x + bar.width, "the rail ends where the lines end").toBeCloseTo(grid!.x + grid!.width, 0);
  expect(grip.width / bar.width).toBeCloseTo(2 / 3, 1);
  expect(grip.x + grip.width).toBeCloseTo(bar.x + bar.width, 0);
  // The thin bar fills the strip (8 px of the 10 above the top line); the part of the rail that takes a press reaches well below it, to be easy to catch with a thumb.
  expect(bar.height).toBeGreaterThanOrEqual(8);
  const rail = (await page.locator(".season-snapshot-rail").boundingBox())!;
  expect(rail.height, "the grab area is much taller than the bar").toBeGreaterThanOrEqual(bar.height + 10);
  expect(rail.y + rail.height - (bar.y + bar.height), "and hangs below it, never above").toBeGreaterThanOrEqual(10);
  // The pointer stays an ordinary arrow over every part of the rail: no hand, open or closed.
  for (const name of [".season-snapshot-rail", ".season-snapshot-rail-track", ".season-snapshot-rail-thumb"]) {
    expect(await page.locator(name).evaluate((element) => getComputedStyle(element).cursor), name).toBe("default");
  }

  // Dragging the thumb to the left end scrolls the chart back to the first weeks.
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x, grip.y + grip.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(scrollLeft).toBe(0);
  ({ track: bar, thumb: grip } = await boxes());
  expect(grip.x).toBeCloseTo(bar.x, 0);

  await expect(page.locator(".season-snapshot-rail"), "a finished drag leaves nothing held").not.toHaveClass(/is-dragging/);

  // Pressing the track near its right end brings back the latest weeks.
  await page.mouse.click(bar.x + bar.width - 2, bar.y + bar.height / 2);
  await expect.poll(scrollLeft).toBeGreaterThan(0);
  ({ track: bar, thumb: grip } = await boxes());
  expect(grip.x + grip.width).toBeCloseTo(bar.x + bar.width, 0);

  // So does pressing in the grab area below the bar, where no bar is drawn: back to the first weeks at its left end.
  await page.mouse.click(bar.x + 2, bar.y + bar.height + 7);
  await expect.poll(scrollLeft).toBe(0);
  await page.mouse.click(bar.x + bar.width - 2, bar.y + bar.height + 7);
  await expect.poll(scrollLeft).toBeGreaterThan(0);
  ({ track: bar, thumb: grip } = await boxes());
  expect(grip.x + grip.width).toBeCloseTo(bar.x + bar.width, 0);

  // The rail takes no room of its own: All draws the axis and the week numbers in exactly the same place.
  const layout = () => page.evaluate(() => ["season-snapshot-yaxis", "season-snapshot-week-label"].map((name) => {
    const box = document.querySelector(`.${name}`)!.getBoundingClientRect();
    return [Math.round(box.top), Math.round(box.height)];
  }));
  const windowed = await layout();
  await weeks.getByRole("button", { name: "All" }).click();
  await expect(page.locator(".season-snapshot-rail")).toHaveCount(0);
  expect(await layout()).toEqual(windowed);
});

test("in the 6 Wk view the axis fits the weeks in view and follows them as the chart scrolls", async ({ page }) => {
  await open(page, nineWeekSnapshot(14));
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
  const settledTicks = () => page.evaluate(() => [...document.querySelectorAll(".season-snapshot-yaxis .season-snapshot-tick:not(.is-leaving)")].map((text) => Number(text.textContent)));
  const leaving = page.locator(".season-snapshot-tick.is-leaving");
  const spacing = (ticks: number[]) => new Set(ticks.slice(1).map((tick, index) => tick - ticks[index]));

  // It opens on the latest six weeks, where nobody is near zero: the axis starts higher.
  await expect.poll(async () => (await settledTicks())[0]).toBeGreaterThan(0);
  await expect(leaving).toHaveCount(0);
  const latest = await settledTicks();
  expect(spacing(latest).size, "evenly spaced").toBe(1);
  expect(latest.length, "six numbered lines at most").toBeLessThanOrEqual(6);

  // Drag the rail back to the first weeks: the axis glides down to zero, where everyone starts.
  const bar = (await page.locator(".season-snapshot-rail-track").boundingBox())!;
  const grip = (await page.locator(".season-snapshot-rail-thumb").boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x, grip.y + grip.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await settledTicks())[0]).toBe(0);
  await expect(leaving, "numbers that left the axis are gone once it settles").toHaveCount(0);
  // Exactly weeks 0 to 6 are drawn: the lines stop at week 6 instead of running on toward week 7.
  const cut = await page.evaluate(() => {
    const weekLines = [...document.querySelectorAll(".season-snapshot-plot-scroll line[stroke-dasharray]")].map((line) => Number(line.getAttribute("x1")));
    const lines = document.querySelector(".season-snapshot-lines")!.parentElement!.getAttribute("clip-path")!.match(/#([^)]+)/)![1];
    const box = document.getElementById(lines)!.querySelector("rect")!;
    return { from: Number(box.getAttribute("x")), to: Number(box.getAttribute("x")) + Number(box.getAttribute("width")), week6: weekLines[5] };
  });
  expect(cut.from, "the lines start at week 0").toBeCloseTo(6, 0);
  expect(cut.to, "and end at week 6").toBeCloseTo(cut.week6, 0);
  const first = await settledTicks();
  expect(spacing(first).size, "evenly spaced").toBe(1);
  expect(first.length, "six numbered lines at most").toBeLessThanOrEqual(6);
  expect(first.at(-1)!, "the first weeks need less room at the top").toBeLessThan(latest.at(-1)!);
});

test("in 6 Wk the starting points show only when a week rests at the left edge; between weeks the lines reach the edge", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
  const plot = page.locator(".season-snapshot-plot-scroll");
  await expect(plot).toHaveClass(/is-windowed/);
  // Every collapsed end (a line's starting point), by where it sits against the window's left edge (the plot starts 6 pixels in).
  const points = () => plot.evaluate((scroll) => {
    const left = scroll.scrollLeft + 6;
    const found = { onEdge: 0, inside: 0 };
    for (const path of scroll.querySelectorAll<SVGPathElement>(".season-snapshot-ribbon path:first-child")) {
      // M top-start L top-end L bottom-end L bottom-start Z
      const [a, b, c, d] = path.getAttribute("d")!.match(/[^MLZ ]+,[^MLZ ]+/g)!.map((pair) => pair.split(",").map(Number));
      for (const [top, bottom] of [[a, d], [b, c]]) {
        if (Math.abs(top[1] - bottom[1]) > 0.01) continue;
        if (Math.abs(top[0] - left) < 1) found.onEdge += 1;
        else if (top[0] > left) found.inside += 1;
      }
    }
    return found;
  });
  const resting = await points();
  expect(resting.onEdge, "resting on a week, the points sit on the edge").toBeGreaterThan(0);
  expect(resting.inside).toBe(0);
  const step = await plot.evaluate((scroll) => (scroll.clientWidth - 20) / 6);
  await plot.evaluate((scroll, back) => { scroll.scrollLeft -= back; }, step * 1.5);
  await expect.poll(async () => (await points()).inside, "between weeks no point shows inside the window").toBe(0);
  expect((await points()).onEdge, "the points slid out of view with the window").toBe(0);
});

test("hiding a player removes their line and rescales the axis; nobody's color moves; Show all restores", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await expect(keyRows(page).first()).toBeVisible();
  // The key shows the chart's own totals: the leader's last plotted week, not a separate tally.
  await expect(keyRows(page).first().locator("strong")).toHaveText("16");
  const count = await keyRows(page).count();
  const swatchOf = (index: number) => keyRows(page).nth(index).locator(".season-snapshot-swatch").evaluate((element) => getComputedStyle(element).backgroundColor);
  const colorsBefore = await Promise.all(Array.from({ length: count }, (_, index) => swatchOf(index)));
  expect(new Set(colorsBefore).size, "every player has a distinct color").toBe(count);
  const fillsBefore = await ribbonFills(page);
  const ticksBefore = await axisScale(page);
  const leader = keyRows(page).first();
  await leader.click();
  await expect(leader).toHaveAttribute("aria-pressed", "false");
  const fillsAfter = await ribbonFills(page);
  expect(fillsAfter.length).toBeLessThan(fillsBefore.length);
  // The axis glides to its new range; the numbers that leave it fade out and are gone once it settles.
  await expect.poll(() => axisScale(page), { message: "the axis rescales to whoever remains" }).not.toEqual(ticksBefore);
  // Everyone still on the chart keeps the color they had.
  const colorsAfter = await Promise.all(Array.from({ length: count }, (_, index) => swatchOf(index)));
  expect(colorsAfter).toEqual(colorsBefore);
  const showAll = page.getByRole("button", { name: "Show all" });
  await expect(showAll).toBeEnabled();
  await showAll.click();
  await expect(showAll).toBeDisabled();
  expect(await ribbonFills(page)).toEqual(fillsBefore);
});

test("chart choices are remembered on this device", async ({ page }) => {
  await open(page);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
  await keyRows(page).first().click();
  await page.reload();
  await expect(page.locator(".my-ticket")).toBeVisible({ timeout: 30_000 });
  await flipButton(page).click();
  await expect(page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" })).toHaveAttribute("aria-pressed", "true");
  await expect(keyRows(page).first()).toHaveAttribute("aria-pressed", "false");
});

test("in the 6 Wk view only the rail moves the weeks: a sideways wheel, a drag across the graph and the arrow keys on it do nothing", async ({ page }) => {
  await open(page, nineWeekSnapshot(14));
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
  const plot = page.locator(".season-snapshot-plot-scroll");
  await expect(plot).toHaveClass(/is-windowed/);
  const scrollLeft = () => plot.evaluate((element) => element.scrollLeft);
  const resting = await scrollLeft();
  expect(resting).toBeGreaterThan(0);
  expect(await plot.evaluate((element) => getComputedStyle(element).overflowX), "the graph is not a scroller").toBe("hidden");
  await expect(plot, "and does not take the keyboard").not.toHaveAttribute("tabindex", /.*/);

  const box = (await plot.boundingBox())!;
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.wheel(-900, 0);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.95, middle.y, { steps: 10 });
  await page.mouse.up();
  await page.mouse.click(middle.x, middle.y);
  for (let press = 0; press < 3; press += 1) await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(400);
  expect(await scrollLeft(), "the weeks stayed where they were").toBe(resting);
  await expect(page.locator(".season-snapshot-lines")).toBeVisible();
});

test("the rail can be used from the keyboard: arrows step one week, Home and End go to either end, and it says which weeks are shown", async ({ page }) => {
  await open(page, nineWeekSnapshot(14));
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
  const plot = page.locator(".season-snapshot-plot-scroll");
  const rail = page.getByRole("slider", { name: "Move the weeks shown" });
  const scrollLeft = () => plot.evaluate((element) => element.scrollLeft);
  const step = await plot.evaluate((element) => (element.clientWidth - 20) / 6);
  // The browser keeps a scroll position to whole pixels, so a week's width is matched to within one.
  const scrolledTo = (expected: number) => expect.poll(async () => Math.abs((await scrollLeft()) - expected) < 2, { message: `scrolled to about ${Math.round(expected)}` }).toBe(true);
  // Fourteen weeks, six in view: it opens on weeks 9 to 14.
  await expect(rail).toHaveAttribute("aria-valuemin", "1");
  await expect(rail).toHaveAttribute("aria-valuemax", "9");
  await expect(rail).toHaveAttribute("aria-valuenow", "9");
  await expect(rail).toHaveAttribute("aria-valuetext", "Weeks 9 to 14");
  const latest = await scrollLeft();
  await rail.focus();
  await page.keyboard.press("ArrowLeft");
  await scrolledTo(latest - step);
  await expect(rail).toHaveAttribute("aria-valuetext", "Weeks 8 to 13");
  await page.keyboard.press("ArrowRight");
  await scrolledTo(latest);
  await page.keyboard.press("Home");
  await expect.poll(scrollLeft).toBe(0);
  await expect(rail).toHaveAttribute("aria-valuetext", "Weeks 1 to 6");
  await page.keyboard.press("PageDown");
  await scrolledTo(step * 6);
  await page.keyboard.press("End");
  await scrolledTo(latest);
  await expect(rail).toHaveAttribute("aria-valuetext", "Weeks 9 to 14");
});

test("the player key's rows come out even at every width, eleven names or eight", async ({ page }) => {
  const elevenPlayers = withElevenPlayers(homeResponse(SCENARIO), nineWeekSnapshot());
  await open(page, elevenPlayers.snapshot, elevenPlayers.home);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await expect(keyRows(page)).toHaveCount(11);
  // The names on each line of the key, top to bottom.
  const lines = () => page.evaluate(() => {
    const sizes = new Map<number, number>();
    for (const row of document.querySelectorAll(".season-snapshot-key-row")) {
      const top = Math.round(row.getBoundingClientRect().top);
      sizes.set(top, (sizes.get(top) ?? 0) + 1);
    }
    return [...sizes.entries()].sort((a, b) => a[0] - b[0]).map(([, count]) => count);
  });
  for (const width of [800, 1000, 1280, 1700]) {
    await page.setViewportSize({ width, height: 1400 });
    await expect.poll(async () => {
      const sizes = await lines();
      return sizes.length > 0 && sizes.slice(0, -1).every((size) => size === sizes[0]) && sizes[0] - sizes.at(-1)! <= 1 && sizes.reduce((sum, size) => sum + size, 0) === 11;
    }, { message: `eleven names at ${width} px sit in even rows` }).toBe(true);
  }
  // At 1280 the box is wide enough for six across: six and five, not an eight-name line with three left over.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await expect.poll(lines).toEqual([6, 5]);
  // A phone keeps its fixed four across.
  await page.setViewportSize({ width: 390, height: 1400 });
  await expect.poll(lines).toEqual([4, 4, 3]);
});

// The 6 Wk rail's thin track is centered in the open space between the masthead's rule and the top grid line, at every width.
for (const width of [390, 700, 1280]) {
  test(`the 6 Wk rail track is centered between the masthead rule and the top line at ${width}px`, async ({ page }) => {
    await open(page);
    await page.setViewportSize({ width, height: 1400 });
    await flipButton(page).click();
    await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
    await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
    await expect(page.locator(".season-snapshot-rail-track")).toBeVisible();
    await page.waitForTimeout(600);   // the axis glides to its range
    const { above, below } = await page.evaluate(() => {
      const track = document.querySelector(".season-snapshot-rail-track")!.getBoundingClientRect();
      const rule = document.querySelector(".season-snapshot .pickem-ledger-masthead")!.getBoundingClientRect().bottom;
      const topLine = Math.min(...[...document.querySelectorAll(".season-snapshot-plot-scroll line.season-snapshot-tick:not(.is-leaving)")].map((line) => line.getBoundingClientRect().top));
      return { above: track.top - rule, below: topLine - track.bottom };
    });
    expect(above, "clear of the rule").toBeGreaterThan(2);
    expect(below, "clear of the top line").toBeGreaterThan(2);
    expect(Math.abs(above - below), `${above.toFixed(1)}px above, ${below.toFixed(1)}px below`).toBeLessThanOrEqual(1);
  });
}

// A touch screen leaves :hover stuck on whatever was tapped, until the next tap elsewhere. The rail's swell is for a mouse over it or a finger on it
// (the dragging state), never for that stuck hover. The browser is made to treat the rail as hovered, as it would be after a tap on a phone.
async function holdHover(page: Page, selector: string) {
  const client = await page.context().newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");
  const { root } = await client.send("DOM.getDocument");
  const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  await client.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
}
async function openSixWeeks(page: Page) {
  await open(page);
  await flipButton(page).click();
  await page.getByRole("group", { name: "Season half shown" }).getByRole("button", { name: "Season" }).click();
  await page.getByRole("group", { name: "Weeks shown" }).getByRole("button", { name: "6 Wk" }).click();
  await expect(page.locator(".season-snapshot-rail-thumb")).toBeVisible();
}
const thumbRing = (page: Page) => page.locator(".season-snapshot-rail-thumb").evaluate((element) => getComputedStyle(element).boxShadow);

test("with a mouse, the rail thumb swells while the pointer is over it", async ({ page }) => {
  await openSixWeeks(page);
  expect(await thumbRing(page), "at rest").toBe("none");
  await holdHover(page, ".season-snapshot-rail");
  expect(await thumbRing(page), "hovered").not.toBe("none");
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });
  test("a tap leaves the rail thumb at rest once the finger lifts: it swells only while dragging", async ({ page }) => {
    await openSixWeeks(page);
    expect(await page.evaluate(() => matchMedia("(hover: hover)").matches), "a touch screen cannot hover").toBe(false);
    expect(await thumbRing(page), "at rest").toBe("none");
    const box = (await page.locator(".season-snapshot-rail-thumb").boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(".season-snapshot-rail.is-dragging")).toHaveCount(0);
    await holdHover(page, ".season-snapshot-rail");   // what the tap leaves behind
    expect(await thumbRing(page), "stuck hover after the tap").toBe("none");
  });
});
