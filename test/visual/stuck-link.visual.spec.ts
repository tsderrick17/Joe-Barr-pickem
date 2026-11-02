import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";
import { homeResponse } from "./standings-fixtures.mjs";

// A tapped link that never gets its page data (a page left open across a deploy, a connection the phone put to sleep) must not leave the
// player staring at a page that ignores them. Driven in a real browser against fixtures; no screenshots are compared.

async function open(page: Page, answerPageData: boolean) {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/home**", (route) => route.fulfill({ json: homeResponse("commissioner-playoff") }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  // What Next asks the server for when a link is tapped (or to get ready for one) carries an RSC header. Leaving those unanswered is the stuck page.
  if (!answerPageData) await page.route("**/*", (route) => route.request().headers()["rsc"] ? undefined : route.fallback());
  await page.goto("/");
  await expect(page.locator(".my-ticket")).toBeVisible({ timeout: 30_000 });
  // A normal page load starts this over; moving between pages inside the app does not.
  await page.evaluate(() => { (window as unknown as { samePage: boolean }).samePage = true; });
}

const slateLink = (page: Page) => page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "The Slate" });
const samePage = (page: Page) => page.evaluate(() => (window as unknown as { samePage?: boolean }).samePage === true);

test("a tapped link whose page data never arrives loads the page normally after a few seconds", async ({ page }) => {
  await open(page, false);
  await slateLink(page).click();
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname, "nothing has moved yet, and it is not given up on at once").toBe("/");
  await expect(page).toHaveURL(/\/board$/, { timeout: 9000 });
  await page.waitForLoadState("load");
  expect(await samePage(page), "the page was loaded fresh").toBe(false);
});

test("a link that works moves inside the app and is never reloaded behind the player", async ({ page }) => {
  await open(page, true);
  await slateLink(page).click();
  await expect(page).toHaveURL(/\/board$/);
  await page.waitForTimeout(5500);
  expect(await samePage(page), "moved without a page load, and nothing reloaded it later").toBe(true);
});

test("going back before the wait is over is not undone by it", async ({ page }) => {
  await open(page, true);
  await slateLink(page).click();
  await expect(page).toHaveURL(/\/board$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForTimeout(5500);
  expect(new URL(page.url()).pathname, "still on the first page").toBe("/");
  expect(await samePage(page)).toBe(true);
});
