import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
import { BOWL_BY_SCENARIO, bowlResponse, homeResponse, seasonSnapshotResponse } from "./standings-fixtures.mjs";

// The pool chat sits at the foot of every player page. The other suites keep it hidden or empty, so this one opens it
// with a few messages (an ordinary one, a moderator's, a removed one, one you can delete) and checks the box itself:
// closed, with the emoji picker open, and with the message field focused.
const WIDTHS = { "phone-390": 390, "desktop-1280": 1280 } as const;

const MESSAGES = [
  { id: "m1", body: "Who has the Rams tonight? I need one more win.", canDelete: false, createdAt: "2026-10-04T14:05:00Z", isDeleted: false, isModerator: false, playerName: "Gary" },
  { id: "m2", body: "Picks lock at each kickoff, so check your ticket before Sunday.", canDelete: true, createdAt: "2026-10-04T13:40:00Z", isDeleted: false, isModerator: true, playerName: "Commissioner" },
  { id: "m3", body: "", canDelete: false, createdAt: "2026-10-04T13:10:00Z", isDeleted: true, isModerator: false, playerName: "Rick" },
  { id: "m4", body: "Nice week, Connor.", canDelete: true, createdAt: "2026-10-03T22:30:00Z", isDeleted: false, isModerator: false, playerName: "Tyler" },
];


async function serve(page: Page) {
  const home = homeResponse("regular-in");
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: home }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: home.isCommissioner, showPoolChat: true } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: MESSAGES } }));
  await page.route("**/api/bowl-pool**", (route) => route.fulfill({ json: bowlResponse((BOWL_BY_SCENARIO as Record<string, Parameters<typeof bowlResponse>[0]>)["regular-in"]) }));
  await page.route("**/api/season-snapshot**", (route) => route.fulfill({ json: seasonSnapshotResponse("regular-in") }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(home.serverTime) });
}

for (const theme of ["day", "night"]) {
  for (const [label, width] of Object.entries(WIDTHS)) {
    test(`Pool chat ${theme} at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, theme);
      await serve(page);
      await page.goto("/");
      const chat = page.locator(".pool-chat");
      // The colour emoji artwork (the picker's buttons and the smiley that opens it) settles a few pixels differently from
      // one run to the next, so those glyphs are masked: each button's place and size are still checked.
      const emojiButton = chat.getByRole("button", { name: "Choose an emoji" });
      await expect(chat.locator("article")).toHaveCount(4, { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await chat.scrollIntoViewIfNeeded();
      // The pointer is parked outside the box for every shot: an emoji button lifts a pixel when it is hovered, and whether the pointer (left
      // where the smiley was clicked) had been counted as over one when the picker opened changed from run to run.
      await page.mouse.move(0, 0);
      await expect(chat).toHaveScreenshot(`chat-${theme}-${label}.png`, { mask: [emojiButton] });

      await emojiButton.click();
      await expect(chat.getByRole("group").first()).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(chat).toHaveScreenshot(`chat-emoji-${theme}-${label}.png`, { mask: [emojiButton, chat.getByRole("group").locator("button")] });

      await emojiButton.click();
      await chat.locator("#pool-chat-message").fill("Anyone else on the Chiefs?");
      await page.mouse.move(0, 0);
      await expect(chat).toHaveScreenshot(`chat-typing-${theme}-${label}.png`, { mask: [emojiButton] });
    });
  }
}
