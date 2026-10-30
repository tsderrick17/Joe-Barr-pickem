import { expect, test, type Page } from "@playwright/test";
import { TROPHY_ROOM } from "./commissioner-fixtures.mjs";

// The Trophy Room's turntable: three trophies on a mahogany table that turns only by its arrows, and the banners of the trophy at the front.

async function openTrophyRoom(page: Page, width = 900, { holdChampions = false } = {}) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
  await page.addInitScript((value) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, JSON.stringify(session));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\//, "");
    if (path === "trophy-room") return holdChampions ? undefined : route.fulfill({ json: TROPHY_ROOM });   // held: the champions never arrive
    if (path === "profile") return route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } });
    if (path === "pool-chat") return route.fulfill({ json: { messages: [] } });
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/trophy-room");
  await expect(page.locator(".trophy-turn-stage")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
}

test("while the champions are still loading the rafters stay bare: no \"No champion yet\" for a trophy that has one", async ({ page }) => {
  await openTrophyRoom(page, 900, { holdChampions: true });
  await expect(page.getByText("Loading the Trophy Room…")).toBeVisible();
  await expect(page.locator(".trophy-rafters")).toBeVisible();
  await expect(page.locator(".trophy-banners-empty")).toHaveCount(0);
  await expect(page.locator(".trophy-banner")).toHaveCount(0);
});

const front = (page: Page) => page.getByRole("status").filter({ hasText: "at the front" });

test("the arrows bring the next trophy to the front, and its champions hang from the rafters", async ({ page }) => {
  await openTrophyRoom(page);
  await expect(front(page)).toHaveText("Pick’em is at the front");
  await expect(page.locator(".trophy-rafters")).toHaveAttribute("data-pool", "pickem");
  // One banner per person, oldest first: Tyler has won twice, so his one banner carries both years; the 2026 co-champions each have their own.
  await expect(page.locator(".trophy-banner")).toHaveText([/Tyler[\s\S]*2024[\s\S]*2025/, /Gary[\s\S]*2026/, /Rick[\s\S]*2026/]);
  // Pick'em hangs red banners, the college Bowl Pool blue ones, Survivor green.
  const banner = async () => {   // the browser reports the colour in the Lab space: a is red-green (positive is red), b is yellow-blue (negative is blue)
    const text = await page.locator(".trophy-rafters").evaluate((rafters) => getComputedStyle(rafters).getPropertyValue("--banner").trim());
    const [, a, b] = (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    return { a, b };
  };
  expect((await banner()).a).toBeGreaterThan(30);
  expect((await banner()).b).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Bring the next trophy forward" }).click();
  await expect(front(page)).toHaveText("Bowl Pool is at the front");
  await expect(page.locator(".trophy-rafters")).toHaveAttribute("data-pool", "bowl");
  expect((await banner()).b).toBeLessThan(-30);
  await expect(page.locator(".trophy-banner")).toHaveText([/Connor[\s\S]*2026/]);
  await page.getByRole("button", { name: "Bring the next trophy forward" }).click();
  await expect(front(page)).toHaveText("Survivor is at the front");
  await expect(page.locator(".trophy-banner")).toHaveText([/Zac[\s\S]*2025/]);
  await page.getByRole("button", { name: "Bring the previous trophy forward" }).click();
  await expect(front(page)).toHaveText("Bowl Pool is at the front");
});

test("the banners stay while the table turns, and are replaced by the next trophy's once it has settled", async ({ page }) => {
  await openTrophyRoom(page);
  await page.getByRole("button", { name: "Bring the next trophy forward" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Turning" })).toBeVisible();
  // mid-turn the Pick'em banners are still hanging, and nothing has lifted
  await expect(page.locator(".trophy-rafters")).toHaveAttribute("data-pool", "pickem");
  await expect(page.locator(".trophy-rafters")).toHaveAttribute("data-moving", "false");
  await expect(page.locator(".trophy-banner").first()).toContainText("Tyler");
  await expect(front(page)).toHaveText("Bowl Pool is at the front");
  await expect(page.locator(".trophy-rafters")).toHaveAttribute("data-pool", "bowl");   // swapped only after it settled
  await expect(page.locator(".trophy-banner")).toHaveText([/Connor[\s\S]*2026/]);
  expect(await page.locator(".trophy-banner").first().evaluate((banner) => getComputedStyle(banner).animationName)).toContain("trophy-banner-unfurl");
});

test("a phone is sent the smaller pictures (the same 120 views at 660 wide), a desktop the full set", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => { if (/\/trophies\/turntable\/(sm\/)?(frame|rest)-\d+\.webp/.test(request.url())) requested.push(new URL(request.url()).pathname); });
  await openTrophyRoom(page, 390);
  const small = requested.filter((path) => path.includes("/sm/"));
  expect(small.filter((path) => path.includes("/frame-")).length, "all 120 small pictures").toBe(120);
  expect(small.filter((path) => path.includes("/rest-")).length, "and the 3 sharp resting views").toBe(3);
  expect(requested.filter((path) => !path.includes("/sm/") && !path.endsWith("/frame-000.webp")), "no full-size picture was fetched on a phone").toEqual([]);
  await page.close();
});

test("a desktop is sent the full set of 120 pictures", async ({ page }) => {
  const requested = new Set<string>();
  page.on("request", (request) => { if (/\/trophies\/turntable\/frame-\d+\.webp/.test(request.url())) requested.add(new URL(request.url()).pathname); });
  await openTrophyRoom(page, 1280);
  expect(requested.size).toBe(120);
});

test("only the arrows turn the table: a drag across it does nothing", async ({ page }) => {
  await openTrophyRoom(page);
  const stage = page.locator(".trophy-turn-stage");
  const box = (await stage.boundingBox())!;
  const y = box.y + box.height * 0.6;
  await page.mouse.move(box.x + box.width * 0.8, y); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8 - box.width * 0.6, y, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(1200);
  await expect(front(page)).toHaveText("Pick’em is at the front");
  await expect(page.locator(".trophy-rafters")).toHaveAttribute("data-pool", "pickem");
});

test("the table and banners at rest with the Bowl Pool at the front", async ({ page }) => {
  await openTrophyRoom(page);
  await page.getByRole("button", { name: "Bring the next trophy forward" }).click();
  await expect(front(page)).toHaveText("Bowl Pool is at the front");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(1600);
  await expect(page.locator(".trophy-display")).toHaveScreenshot("trophy-turntable-bowl-front.png");
});

// The banners are drawn on a canvas at the screen's full device resolution (and never scaled or rotated), so they stay sharp.
test("the banners are drawn at full device resolution", async ({ browser }) => {
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  await openTrophyRoom(page, 900);
  const canvas = page.locator(".trophy-banner canvas").first();
  await expect(canvas).toBeVisible();
  const sizes = await canvas.evaluate((element) => { const target = element as HTMLCanvasElement; return { drawn: target.width, shown: target.clientWidth, ratio: window.devicePixelRatio }; });
  expect(sizes.ratio).toBe(2);
  expect(sizes.drawn, "one canvas pixel for every screen pixel").toBeGreaterThanOrEqual(Math.round(sizes.shown * 2) - 1);
  await context.close();
});
