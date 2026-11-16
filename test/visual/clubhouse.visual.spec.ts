import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
import { homeResponse } from "./standings-fixtures.mjs";
import { boardResponse } from "./slate-fixtures.mjs";

const SIZES = { "phone-390": { width: 390, height: 844 }, "desktop-1280": { width: 1280, height: 800 } } as const;

/** The real clubhouse at /clubhouse: the Standings' and the Slate's own reads, served from their fixtures. */
async function openClubhouse(page: Page, { theme = "day", size = SIZES["phone-390"] as { width: number; height: number }, commissioner = true } = {}) {
  await page.setViewportSize(size);
  await signIn(page, theme);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const board = boardResponse("upcoming-picked");
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: homeResponse("regular-in") }));
  // Like the real route, the Slate's read refuses without a week (bootstrap=1 asks for the default one).
  await page.route("**/api/board**", (route) => (new URL(route.request().url()).searchParams.get("bootstrap") === "1" ? route.fulfill({ json: board }) : route.fulfill({ status: 400, json: { error: "You must choose a week before viewing the board." } })));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: commissioner, showPoolChat: false } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(board.serverTime) });
  await page.goto("/clubhouse");
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

test("every thing in the room is a link to the real page, the boards show the real week, and the ticket opens the Slate", async ({ page }) => {
  await openClubhouse(page);
  const room = page.getByRole("navigation", { name: "Clubhouse rooms" });
  await expect(room).toBeVisible({ timeout: 30_000 });
  const href = (name: string) => room.getByRole("link", { name, exact: true }).getAttribute("href");
  expect(await href("The Big Board")).toBe("/");
  expect(await href("Make your picks")).toBe("/board");
  expect(await href("Your picks")).toBe("/board");
  expect(await href("Survivor")).toBe("/survivor");
  expect(await href("Trophy Room")).toBe("/trophy-room");
  expect(await href("Constitution")).toBe("/clubhouse/rules");
  // No sample players: the board's leader is the fixture's.
  await expect(page.locator(".lab-room-screen.is-board header")).not.toContainText("WEEK 10");
  await expect(page.locator(".lab-ticker p").first()).toBeVisible();   // the week's games came through
  await expect(page.getByText("You must choose a week")).toHaveCount(0);
  await expect(page.locator("a.lab-room-ticket")).toHaveAttribute("href", "/board");
  // The room is one screen: the page does not scroll, and the chat opens over it.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
  await expect(page.locator(".pool-chat-dock")).toHaveCount(0);
  await room.getByRole("button", { name: "Pool chat", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Pool chat" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Pool chat" })).toBeHidden();
  await room.getByRole("link", { name: "Constitution", exact: true }).click();
  await expect(page.getByRole("article", { name: "Pool constitution" })).toBeVisible();
  await page.getByRole("link", { name: /Back to Clubhouse/ }).first().click();
  await expect(room).toBeVisible();
});

test("a player who is not the Commissioner is sent to the Standings and has no switch", async ({ page }) => {
  await openClubhouse(page, { commissioner: false });
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Clubhouse view|Classic view/ })).toHaveCount(0);
});
