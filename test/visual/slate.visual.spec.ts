import { expect, test, type Page } from "@playwright/test";
import { settleNetwork, signIn } from "./session";
import { boardResponse, SCENARIOS } from "./slate-fixtures.mjs";

const WIDTHS = { "phone-360": 360, "phone-390": 390, "tablet-700": 700, "desktop-900": 900, "desktop-1280": 1280 } as const;

async function serve(page: Page, scenario: string, extra: Record<string, unknown> = {}) {
  const board = { ...boardResponse(scenario), ...extra };
  // Registered first so the specific routes below win (Playwright runs the
  // newest matching route first): nothing else under /api reaches a server.
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/board**", (route) => route.fulfill({ json: board }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(board.serverTime) });
}

async function captureSlate(page: Page, scenario: string, width: number, theme: string, name: string, extra: Record<string, unknown> = {}, before?: (page: Page) => Promise<void>) {
  await page.setViewportSize({ width, height: 900 });
  await signIn(page, theme, "visual-player");
  await serve(page, scenario, extra);
  // First visit caches fonts and images; the capture is the reload, the way a
  // returning player sees it. (Completed rows measure their picker names
  // once fonts are present, so a cold first paint is not deterministic.)
  await page.goto("/board");
  await expect(page.locator(".slate-game-row").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.reload();
  await expect(page.locator(".slate-game-row").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  // Lazy images below the fold load only when scrolled near; touch the
  // whole page, then wait until every image has finished.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 30)); }
    window.scrollTo(0, 0);
  });
  // Lazy images below the fold load only when scrolled near; make them all load now.
  await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((image) => { (image as HTMLImageElement).loading = "eager"; }));
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
  await settleNetwork(page);
  // The Next.js development badge is not part of the product.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if (before) await before(page);
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}

for (const scenario of Object.keys(SCENARIOS)) {
  for (const [label, width] of Object.entries(WIDTHS)) {
    test(`Slate ${scenario} at ${label}`, async ({ page }) => {
      await captureSlate(page, scenario, width, "day", `${scenario}-${label}.png`);
    });
  }
}

// Night: official (teal) lines on the dark rows must stay readable. One picked week and one live week, phone and desktop.
for (const scenario of ["upcoming-picked", "live-survivor", "live-mixed-locks"]) {
  for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
    test(`Slate ${scenario} at night, ${label}`, async ({ page }) => {
      await captureSlate(page, scenario, width, "night", `night-${scenario}-${label}.png`);
    });
  }
}

// Choosing a third pick when two are saved raises the receipt's warning tab, which has the same die-cut corners.
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Slate receipt warning at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day", "visual-player");
    await serve(page, "upcoming-picked");
    await page.goto("/board");
    await expect(page.locator(".slate-game-row").first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".slate-game-row button.slate-team-side:not([disabled])").nth(8).click();
    await expect(page.locator(".slate-receipt-warning")).toBeVisible();
    // The notice covers the board; it never adds height to the ticket.
    const heights = await page.evaluate(() => {
      const strip = document.querySelector(".slate-receipt-strip")!.getBoundingClientRect(), note = document.querySelector(".slate-receipt-warning")!.getBoundingClientRect();
      return { strip: strip.height, gap: Math.abs(note.top - strip.bottom) };
    });
    expect(heights.gap).toBeLessThanOrEqual(2);
    expect(heights.strip).toBeLessThan(140);
    await page.waitForTimeout(600);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const box = (await page.locator(".slate-receipt-strip").boundingBox())!;
    await expect(page).toHaveScreenshot(`receipt-warning-${label}.png`, { clip: { x: Math.max(0, box.x - 8), y: box.y - 8, width: Math.min(width, box.width + 16), height: box.height + 140 } });
  });
}

// An early-lock note is one line under the spread: the spread stays level with the team names, and the note stays inside its row
// and clear of the poker chips, at every width.
for (const width of [360, 390, 700, 1280]) {
  for (const scenario of ["upcoming-unpicked", "upcoming-no-survivor"]) {
    test(`Slate early-lock note keeps the line level and tidy (${scenario}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "day", "visual-player");
      await serve(page, scenario);
      await page.goto("/board");
      const note = page.locator(".slate-lock-note").first();
      await note.waitFor({ timeout: 30_000 });
      const layout = await note.evaluate((element) => {
        const row = element.closest(".slate-game-row")!;
        const box = element.getBoundingClientRect(), rowBox = row.getBoundingClientRect();
        const spread = row.querySelector(".slate-spread-cell span")!.getBoundingClientRect();
        const name = row.querySelector(".slate-team-label")!.getBoundingClientRect();
        const chips = [...row.querySelectorAll("button")].map((chip) => chip.getBoundingClientRect()).filter((chip) => chip.width > 20 && chip.width < 80);
        return {
          lines: Math.round(box.height / parseFloat(getComputedStyle(element).lineHeight)),
          insideRow: box.top >= rowBox.top && box.bottom <= rowBox.bottom,
          clearOfChips: chips.every((chip) => box.right <= chip.left || box.left >= chip.right || box.bottom <= chip.top + 6 || box.top >= chip.bottom - 6),
          offset: Math.abs((spread.top + spread.bottom) / 2 - (name.top + name.bottom) / 2),
          // Room above the teams, in this row and in the first row without a note.
          topGap: name.top - rowBox.top,
          plainTopGap: (() => {
            const plain = [...document.querySelectorAll(".slate-game-row:not(.has-lock-note)")][0];
            return plain ? plain.querySelector(".slate-team-label")!.getBoundingClientRect().top - plain.getBoundingClientRect().top : null;
          })(),
        };
      });
      expect(layout.lines).toBe(1);
      expect(layout.insideRow).toBe(true);
      expect(layout.clearOfChips).toBe(true);
      expect(layout.offset).toBeLessThanOrEqual(1);
      // The note's row does not get extra room above the teams.
      if (layout.plainTopGap !== null) expect(Math.abs(layout.topGap - layout.plainTopGap)).toBeLessThanOrEqual(2);
    });
  }
}

// The Survivor instruction is only for a player who can still pick that week: shown while they are in, gone once they are out.
for (const [scenario, shown] of [["upcoming-unpicked", true], ["upcoming-no-survivor", false]] as const) {
  test(`Slate Survivor instruction ${shown ? "shows" : "is gone"} (${scenario})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await signIn(page, "day", "visual-player");
    await serve(page, scenario);
    await page.goto("/board");
    await page.locator(".slate-game-row").first().waitFor({ timeout: 30_000 });
    await expect(page.getByText("Click a poker chip to choose a team.")).toHaveCount(shown ? 1 : 0);
  });
}

// The Pick'em line at the foot of the ticket ("1/2 · CHANGED · 1 DUE") stays on one line, and it and every pick chip stay inside the
// ticket at every width, in the longest states: one team picked and unsaved, a live week with locked picks, and one pick sealed with
// the other still open (which once pushed the second chip and the line past the ticket's edge on a phone).
for (const width of [360, 390, 700]) {
  for (const [scenario, pick] of [["upcoming-unpicked", true], ["upcoming-picked", false], ["live-survivor", false], ["live-no-survivor", false], ["live-mixed-locks", false], ["playoff-live", false]] as const) {
    test(`Slate ticket status line is one line (${scenario}${pick ? ", one team picked" : ""}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "day", "visual-player");
      await serve(page, scenario);
      await page.goto("/board");
      await page.locator(".slate-game-row").first().waitFor({ timeout: 30_000 });
      if (pick) await page.locator(".slate-game-row button.slate-team-side:not([disabled])").first().click();
      const line = page.locator(".slate-receipt-pickem > em");
      await expect(line).toBeVisible();
      const fit = await line.evaluate((element) => {
        const box = element.getBoundingClientRect(), ticket = element.closest(".slate-receipt-strip")!.getBoundingClientRect();
        const section = element.parentElement!.getBoundingClientRect();
        const chips = [...document.querySelectorAll(".slate-receipt-selection-chip")].map((chip) => chip.getBoundingClientRect());
        return {
          lines: Math.round(box.height / parseFloat(getComputedStyle(element).lineHeight)),
          inside: element.scrollWidth <= element.clientWidth + 1 && box.right <= section.right + 1 && section.right <= ticket.right + 1,
          chipsInside: chips.every((chip) => chip.left >= ticket.left - 1 && chip.right <= ticket.right + 1),
          text: element.textContent,
        };
      });
      expect(fit.lines, fit.text ?? "").toBe(1);
      expect(fit.inside, fit.text ?? "").toBe(true);
      expect(fit.chipsInside, fit.text ?? "").toBe(true);
    });
  }
}

// An unsaved change beside a sealed pick: "2/2 · CHANGED", the new team's chip marked as a draft next to the locked one.
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Slate receipt with a change beside a sealed pick at ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day", "visual-player");
    await serve(page, "live-mixed-locks");
    await page.goto("/board");
    const receipt = page.locator(".slate-receipt-strip");
    await expect(receipt.locator(".slate-receipt-selection-chip")).toHaveCount(2, { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await receipt.getByRole("button", { name: /^Remove / }).click();
    await page.locator(".slate-game-row button.slate-team-side:not([disabled])").filter({ hasText: /mia$/ }).first().click();
    await expect(receipt.locator(".slate-receipt-pickem > em")).toHaveText("2/2 · CHANGED");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expect(receipt).toHaveScreenshot(`receipt-changed-beside-sealed-${label}.png`);
  });
}

// The sweep: every mix a real week can put on the ticket (picks sealed, open, unsaved or still to make; Survivor on the ticket or not;
// a regular week or a playoff round; the widest chips, an away underdog of 10.5 or 11.5; and mid-save). In every one the chips, the
// Survivor pick and the status line stay inside the ticket, the line stays on one line, and no chip cuts its text short.
const SWEEP: Array<{ name: string; base: string; picks: string[][]; edit?: "remove" | "save" }> = [
  { name: "two sealed, widest chip", base: "live-no-survivor", picks: [["g7", "ten"], ["g4", "gb"]] },
  { name: "sealed and open, widest chips", base: "live-no-survivor", picks: [["g7", "ten"], ["g10", "mia"]] },
  { name: "sealed and open, widest chips, with Survivor", base: "live-survivor", picks: [["g7", "ten"], ["g10", "mia"]] },
  { name: "sealed, the open pick taken off", base: "live-no-survivor", picks: [["g7", "ten"], ["g10", "mia"]], edit: "remove" },
  { name: "sealed, the open pick taken off, with Survivor", base: "live-survivor", picks: [["g7", "ten"], ["g10", "mia"]], edit: "remove" },
  { name: "sealed and changed, while saving", base: "live-survivor", picks: [["g7", "ten"], ["g10", "mia"]], edit: "save" },
  { name: "one sealed, one due", base: "live-no-survivor", picks: [["g7", "ten"]] },
  { name: "two open, widest chip", base: "live-survivor", picks: [["g10", "mia"], ["g11", "den"]] },
  { name: "playoffs: four of six, two sealed", base: "playoff-live", picks: [["g0", "buf"], ["g2", "kc"], ["g3", "lar"], ["g4", "bal"]] },
  { name: "playoffs: six of six, three sealed", base: "playoff-live", picks: [["g0", "buf"], ["g1", "gb"], ["g2", "kc"], ["g3", "lar"], ["g4", "bal"], ["g5", "sf"]] },
  { name: "playoffs: six of six, one open pick taken off", base: "playoff-live", picks: [["g0", "buf"], ["g1", "gb"], ["g2", "kc"], ["g3", "lar"], ["g4", "bal"], ["g5", "sf"]], edit: "remove" },
];

for (const width of [360, 390, 700]) {
  for (const item of SWEEP) {
    test(`Slate receipt fits the ticket: ${item.name} (${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "day", "visual-player");
      await serve(page, item.base, { myPicks: item.picks.map(([gameId, teamId]) => ({ gameId, teamId })) });
      if (item.edit === "save") await page.route("**/api/picks", () => undefined);   // the save never answers: the ticket stays mid-save
      await page.goto("/board");
      const receipt = page.locator(".slate-receipt-strip");
      await expect(receipt.locator(".slate-receipt-selection-chip")).toHaveCount(item.picks.length, { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      if (item.edit) await receipt.getByRole("button", { name: /^Remove / }).last().click();
      if (item.edit === "save") {
        await page.locator(".slate-game-row button.slate-team-side:not([disabled])").filter({ hasText: /den$/ }).first().click();
        await receipt.getByRole("button", { name: "SUBMIT" }).click();
        await expect(receipt.getByText("PRINTING")).toBeVisible();
      }
      const fit = await receipt.evaluate((strip) => {
        const ticket = strip.getBoundingClientRect();
        const inside = (element: Element) => { const box = element.getBoundingClientRect(); return box.left >= ticket.left - 1 && box.right <= ticket.right + 1; };
        const line = strip.querySelector(".slate-receipt-pickem > em")!;
        const pieces = [...strip.querySelectorAll(".slate-receipt-pool, .slate-receipt-selection-chip, .slate-receipt-survivor-pick, .slate-receipt-pool > em")];
        return {
          text: line.textContent,
          lines: Math.round(line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight)),
          outside: pieces.filter((piece) => !inside(piece)).map((piece) => piece.className),
          lineClipped: line.scrollWidth > line.clientWidth + 1,
          // every pool's own line (the Survivor one too) stays inside its pool
          spills: [...strip.querySelectorAll(".slate-receipt-pool > em")].filter((em) => em.getBoundingClientRect().right > em.parentElement!.getBoundingClientRect().right + 1 || em.scrollWidth > em.clientWidth + 1).map((em) => em.textContent),
          cutShort: [...strip.querySelectorAll(".slate-receipt-selection-chip > span")].filter((label) => label.scrollWidth > label.clientWidth + 1).map((label) => label.textContent),
        };
      });
      expect(fit.lines, fit.text ?? "").toBe(1);
      expect(fit.outside, fit.text ?? "").toEqual([]);
      expect(fit.lineClipped, fit.text ?? "").toBe(false);
      expect(fit.spills, "status lines spilling out of their section").toEqual([]);
      expect(fit.cutShort, "chips whose text is cut short").toEqual([]);
    });
  }
}

// The ticket starts in the same place as the Bowl Pool's: flush under the menu, with the week picker and instructions below it.
for (const width of [390, 1280]) {
  test(`Slate ticket starts flush under the menu (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "day", "visual-player");
    await serve(page, "upcoming-unpicked");
    await page.goto("/board");
    await page.locator(".slate-game-row").first().waitFor({ timeout: 30_000 });
    const tops = await page.evaluate(() => ({
      ticket: document.querySelector(".slate-receipt-strip")!.getBoundingClientRect().top,
      page: document.querySelector("main")!.getBoundingClientRect().top,
      header: document.querySelector(".slate-action-instructions")!.getBoundingClientRect().top,
      ticketBottom: document.querySelector(".slate-receipt-strip")!.getBoundingClientRect().bottom,
    }));
    expect(Math.abs(tops.ticket - tops.page)).toBeLessThanOrEqual(1);
    expect(tops.header).toBeGreaterThan(tops.ticketBottom);
  });
}

// Behavior: every official (teal) line and chip on the night Slate is readable (WCAG AA, 4.5:1) against the row it sits on.
for (const scenario of ["upcoming-picked", "live-survivor"]) {
  test(`Slate official lines are readable at night (${scenario})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await signIn(page, "night", "visual-player");
    await serve(page, scenario);
    await page.goto("/board");
    await expect(page.locator(".slate-game-row").first()).toBeVisible({ timeout: 30_000 });
    const lowest = await page.evaluate(() => {
      const channels = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
      const light = (rgb: number[]) => {
        const [r, g, b] = rgb.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      let count = 0;
      let lowestRatio = Infinity;
      document.querySelectorAll(".official-line-color, small.is-official").forEach((element) => {
        let background = [0, 0, 0, 0];
        for (let node: Element | null = element; node; node = node.parentElement) {
          background = channels(getComputedStyle(node).backgroundColor);
          if (background.length < 4 || background[3] > 0.9) break;
        }
        const [a, b] = [light(channels(getComputedStyle(element).color)), light(background)];
        lowestRatio = Math.min(lowestRatio, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
        count += 1;
      });
      return { count, lowestRatio };
    });
    expect(lowest.count).toBeGreaterThan(0);
    expect(lowest.lowestRatio).toBeGreaterThanOrEqual(4.5);
  });
}

// "How it works": a familiar player sees the short rules with the notes folded, a new one sees everything open, and a
// tap opens the fold. The early-game note always stays in view. Each tap waits out the fold's motion before the screenshot.
const openHowItWorks = async (page: Page) => {
  await page.getByRole("button", { name: "How it works" }).click();
  await expect(page.getByRole("button", { name: "How it works" })).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(500);
};
for (const [label, width] of [["phone-390", 390], ["desktop-1280", 1280]] as const) {
  test(`Slate how it works folded at ${label}`, async ({ page }) => {
    await captureSlate(page, "upcoming-unpicked", width, "day", `how-folded-${label}.png`, { howItWorks: "folded" });
  });
  test(`Slate how it works opened at ${label}`, async ({ page }) => {
    await captureSlate(page, "upcoming-unpicked", width, "day", `how-opened-${label}.png`, { howItWorks: "folded" }, openHowItWorks);
  });
  test(`Slate how it works for a new player at ${label}`, async ({ page }) => {
    await captureSlate(page, "upcoming-unpicked", width, "day", `how-new-player-${label}.png`, { howItWorks: "open" });
  });
  test(`Slate how it works folded at night, ${label}`, async ({ page }) => {
    await captureSlate(page, "upcoming-unpicked", width, "night", `night-how-folded-${label}.png`, { howItWorks: "folded" });
  });
}
test("Slate how it works opened in the playoffs", async ({ page }) => {
  await captureSlate(page, "playoff-upcoming", 390, "day", "how-opened-playoff-phone-390.png", { howItWorks: "folded" }, openHowItWorks);
});

test("Slate how it works folds and opens, and keeps the early-game note in view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day", "visual-player");
  await serve(page, "upcoming-unpicked", { howItWorks: "folded" });
  await page.goto("/board");
  await page.locator(".slate-game-row").first().waitFor({ timeout: 30_000 });
  const toggle = page.getByRole("button", { name: "How it works" });
  const lockNote = page.getByText("Lines lock at 8 AM on gameday, unless otherwise noted.");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(lockNote).toBeHidden();
  await expect(page.getByText("EARLY GAME THIS WEEK: spread locks 6pm prior evening")).toBeVisible();
  await expect(page.getByText("Click a team name to make your 2 against-the-spread picks each week.")).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(lockNote).toBeVisible();
  await expect(page.getByText("A push counts as a loss.")).toBeVisible();
  await toggle.click();
  await expect(lockNote).toBeHidden();
});

test("Slate how it works starts open before the Slate says how", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, "day", "visual-player");
  await serve(page, "upcoming-unpicked");
  await page.goto("/board");
  await page.locator(".slate-game-row").first().waitFor({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "How it works" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Lines lock at 8 AM on gameday, unless otherwise noted.")).toBeVisible();
});
