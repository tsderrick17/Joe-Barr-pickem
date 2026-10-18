import { expect, test, type Page } from "@playwright/test";
import { TROPHY_ROOM } from "./commissioner-fixtures.mjs";

// The Trophy Room's turntable: three trophies on a triangular table that turns by drag, swipe or arrow.

async function openTrophyRoom(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
  await page.addInitScript((value) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, JSON.stringify(session));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\//, "");
    if (path === "admin/trophy-room") return route.fulfill({ json: TROPHY_ROOM });
    if (path === "profile") return route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } });
    if (path === "pool-chat") return route.fulfill({ json: { messages: [] } });
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/admin/trophy-room");
  await expect(page.locator(".trophy-turn-stage img")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}

test("the arrows bring the next trophy to the front, and back again", async ({ page }) => {
  await openTrophyRoom(page);
  const status = page.getByRole("status").filter({ hasText: "at the front" });
  await expect(status).toHaveText("Pick’em is at the front");
  await page.getByRole("button", { name: "Bring the next trophy forward" }).click();
  await expect(status).toHaveText("Bowl Pool is at the front");
  await page.getByRole("button", { name: "Bring the next trophy forward" }).click();
  await expect(status).toHaveText("Survivor is at the front");
  await page.getByRole("button", { name: "Bring the previous trophy forward" }).click();
  await expect(status).toHaveText("Bowl Pool is at the front");
  await expect(page.locator(".trophy-rolls section[data-front='true'] h3")).toHaveText("Bowl Pool");
});

test("dragging turns the table and it settles on the nearest trophy", async ({ page }) => {
  await openTrophyRoom(page);
  const status = page.getByRole("status").filter({ hasText: "at the front" });
  const stage = page.locator(".trophy-turn-stage");
  const box = (await stage.boundingBox())!;
  const y = box.y + box.height * 0.6;
  // a short drag is not enough to change trophy: it springs back
  await page.mouse.move(box.x + box.width * 0.5, y); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 - 60, y, { steps: 6 }); await page.mouse.up();
  await expect(status).toHaveText("Pick’em is at the front");
  // dragging left far enough brings the trophy on the right forward
  await page.mouse.move(box.x + box.width * 0.8, y); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8 - 430, y, { steps: 12 }); await page.mouse.up();
  await expect(status).toHaveText("Bowl Pool is at the front");
});

test("the table at rest with the Bowl Pool at the front", async ({ page }) => {
  await openTrophyRoom(page);
  await page.getByRole("button", { name: "Bring the next trophy forward" }).click();
  await expect(page.getByRole("status").filter({ hasText: "at the front" })).toHaveText("Bowl Pool is at the front");
  await page.waitForTimeout(900);
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))));
  await expect(page.locator(".trophy-turn-stage")).toHaveScreenshot("trophy-turntable-bowl-front.png");
});
