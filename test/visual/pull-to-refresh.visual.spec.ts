import { expect, test, type Page } from "@playwright/test";

// Pull down to refresh runs only in the app added to a home screen. The test marks the page as installed, then drags down
// from the top with synthetic touches (Chromium accepts the Touch constructor).
async function installedApp(page: Page) {
  await page.addInitScript(() => { Object.defineProperty(navigator, "standalone", { value: true }); window.localStorage.setItem("pickem-theme", "day"); });
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
}

async function drag(page: Page, from: number, to: number, release: boolean) {
  await page.evaluate(([startY, endY, end]) => {
    const target = document.body;
    const touch = (y: number) => new Touch({ identifier: 1, target, clientX: 195, clientY: y });
    const send = (type: string, y: number | null) => target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: y === null ? [] : [touch(y)], changedTouches: [touch(y ?? 0)] }));
    send("touchstart", startY);
    for (let step = 1; step <= 10; step += 1) send("touchmove", startY + ((endY - startY) * step) / 10);
    if (end) send("touchend", null);
  }, [from, to, release] as const);
}

test("pulling down far enough shows the football and then reloads the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await installedApp(page);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/has-pull-refresh/);   // the pull is wired up only after the page has hydrated
  await drag(page, 100, 160, false);
  await expect(page.locator(".pull-drip")).toContainText("Pull to refresh");
  await drag(page, 100, 260, false);
  await expect(page.locator(".pull-drip")).toContainText("Release to refresh");
  await expect(page).toHaveScreenshot("pull-to-refresh-ready.png", { clip: { x: 95, y: 0, width: 200, height: 110 } });
  // The drop is drawn inside the header's height and never below it (a page without a header keeps to the 96 px cap).
  const drop = await page.locator(".pull-drip").boundingBox();
  const header = await page.locator("nav").count() ? await page.locator("nav").first().boundingBox() : null;
  expect(drop && drop.y + drop.height <= Math.max(96, header ? header.y + header.height : 0) + 1).toBe(true);
  await page.evaluate(() => { (window as unknown as { marker: string }).marker = "before"; });
  await Promise.all([page.waitForEvent("load"), page.evaluate(() => document.body.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true })))]);
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBeUndefined();
});

test("a short pull springs back without reloading", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await installedApp(page);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/has-pull-refresh/);
  await page.evaluate(() => { (window as unknown as { marker: string }).marker = "kept"; });
  await drag(page, 100, 150, true);
  await expect(page.locator(".pull-drip")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe("kept");
});
