import { expect, test, type Page } from "@playwright/test";
import { boardResponse } from "./slate-fixtures.mjs";

async function signIn(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "visual-player", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "visual-player", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
  await page.addInitScript((value) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, JSON.stringify(session));
}

async function serve(page: Page, picksHandler: (route: import("@playwright/test").Route) => Promise<void>, boardAfterSave?: () => object) {
  const board = boardResponse("upcoming-unpicked");
  let saved = false;
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/board**", (route) => route.fulfill({ json: saved && boardAfterSave ? boardAfterSave() : board }));
  await page.route("**/api/picks", async (route) => { saved = true; await picksHandler(route); });
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: false, showPoolChat: false } }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.clock.install({ time: new Date(board.serverTime) });
}

test("choose a team, submit, and the receipt says saved", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page);
  await serve(page, (route) => route.fulfill({ json: { message: "saved" } }));
  await page.goto("/board");
  const receipt = page.locator("[aria-label='Your weekly receipt']");
  await expect(receipt).toBeVisible({ timeout: 30000 });
  await page.locator(".slate-game-row button").first().click();
  await expect(receipt).toContainText(/READY TO SAVE/);
  await receipt.getByRole("button", { name: "SUBMIT" }).click();
  await expect(receipt).toContainText(/PICKS SAVED|DUE|NEEDED/);
  await expect(receipt).not.toContainText(/READY TO SAVE/);
});

test("a failed save keeps the pick and shows the reason", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page);
  await serve(page, (route) => route.fulfill({ status: 400, json: { error: "Your picks could not be saved: fixture." } }));
  await page.goto("/board");
  const receipt = page.locator("[aria-label='Your weekly receipt']");
  await expect(receipt).toBeVisible({ timeout: 30000 });
  await page.locator(".slate-game-row button").first().click();
  await receipt.getByRole("button", { name: "SUBMIT" }).click();
  await expect(page.getByText("Your picks could not be saved: fixture.")).toBeVisible();
  await expect(receipt).toContainText(/READY TO SAVE/);
});

test("a save whose answer is lost is confirmed from the server, so nothing is left to resubmit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page);
  let chosen: { gameId: string; teamId: string } | null = null;
  await serve(page, async (route) => {
    chosen = JSON.parse(route.request().postData() ?? "{}").selections?.[0] ?? null;
    await route.abort("failed");
  }, () => ({ ...boardResponse("upcoming-unpicked"), myPicks: chosen ? [chosen] : [] }));
  await page.goto("/board");
  const receipt = page.locator("[aria-label='Your weekly receipt']");
  await expect(receipt).toBeVisible({ timeout: 30000 });
  await page.locator(".slate-game-row button").first().click();
  await receipt.getByRole("button", { name: "SUBMIT" }).click();
  await expect(receipt).not.toContainText(/READY TO SAVE/, { timeout: 15000 });
  await expect(page.getByText(/taking too long to save/)).toHaveCount(0);
});
