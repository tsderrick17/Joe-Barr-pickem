import { expect, test, type Page } from "@playwright/test";

// Pull down to refresh runs only in the app added to a home screen. The test marks the page as installed, then drags down
// from the top with synthetic touches (Chromium accepts the Touch constructor).
async function installedApp(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    window.localStorage.setItem("pickem-theme", "day");
    // record the haptic buzzes: a light notch each time the counter drops a down (4 to 3, 3 to 2), then the firmer lock-in when it reaches 1
    (window as unknown as { buzzes: number[][] }).buzzes = [];
    Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36", configurable: true });
    navigator.vibrate = (pattern) => { (window as unknown as { buzzes: number[][] }).buzzes.push([pattern].flat() as number[]); return true; };
  });
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

test("pulling down far enough shows the chain planted and then reloads the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await installedApp(page);
  // The chain twangs and the planted rod leans for a moment after the foot lands, so the picture depends on the instant it is taken. Reduced motion
  // holds the first frame after planting, which makes the screenshot the same every time.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/has-pull-refresh/);   // the pull is wired up only after the page has hydrated
  const buzzes = () => page.evaluate(() => (window as unknown as { buzzes: number[][] }).buzzes);
  const strip = { clip: { x: 0, y: 0, width: 390, height: 110 } };
  // a pull of D px of finger travel is D x 0.6 of pull; the pole lands (the dust puff) at half of 76, the counter has turned to 1 at all of it
  await drag(page, 100, 113, false);   // a tenth of the way: the pole is drawn out, leaning, the chain slack with humps lying on the turf
  await expect(page).toHaveScreenshot("pull-to-refresh-slack.png", strip);
  await drag(page, 100, 132, false);   // a quarter of the way: the chain is stretched to its full length, still leaning, taut and slanting up
  await expect(page).toHaveScreenshot("pull-to-refresh-stretched.png", strip);
  await drag(page, 100, 148, false);   // three eighths: dropping, its foot leading, the chain taut and coming down
  await expect(page.locator(".pull-chain")).toContainText("Pull to refresh");
  await expect(page).toHaveScreenshot("pull-to-refresh-dropping.png", strip);
  await drag(page, 100, 163, false);   // halfway: the foot has landed upright beside the ball, and the counter still says 4
  await expect(page).toHaveScreenshot("pull-to-refresh-landed.png", strip);
  await drag(page, 100, 195, false);   // three quarters: the counter is half way through, its slats reading 1, 4, 1, 4
  await expect(page.locator(".pull-chain")).toContainText("Pull to refresh");
  await expect(page).toHaveScreenshot("pull-to-refresh-counter-halfway.png", strip);
  expect(await buzzes(), "no buzz while the pole is still coming down; one light notch when the counter drops to 3").toEqual([[8]]);
  await drag(page, 100, 260, false);
  await expect(page.locator(".pull-chain")).toContainText("Release to refresh");
  expect(await buzzes(), "a notch for each down the counter drops (3, then 2), and one firm lock-in when it reaches 1").toEqual([[8], [8], [8], [26]]);
  await expect(page).toHaveScreenshot("pull-to-refresh-ready.png", strip);
  // The chain is drawn inside the header's height and never below it (a page without a header keeps to the 96 px cap).
  const drop = await page.locator(".pull-chain").boundingBox();
  const header = await page.locator("nav").count() ? await page.locator("nav").first().boundingBox() : null;
  expect(drop && drop.y + drop.height <= Math.max(96, header ? header.y + header.height : 0) + 1).toBe(true);
  await page.evaluate(() => { (window as unknown as { marker: string }).marker = "before"; });
  // Letting go covers the page with the spinning loading football at once (the page reloads right behind it, so remember that it appeared).
  await page.evaluate(() => new MutationObserver((_records, observer) => {
    if (document.querySelector(".pull-refresh-cover .football-loader")) { sessionStorage.setItem("coverSeen", String(performance.now())); observer.disconnect(); }
  }).observe(document.body, { childList: true, subtree: true }));
  const released = Date.now();
  await Promise.all([page.waitForEvent("load"), page.evaluate(() => document.body.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true })))]);
  expect(await page.evaluate(() => sessionStorage.getItem("coverSeen")), "the football covered the page before it reloaded").not.toBeNull();
  expect(Date.now() - released, "and the reload followed right behind it, not seconds later").toBeLessThan(2500);
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBeUndefined();
});

test("a short pull springs back without reloading", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await installedApp(page);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/has-pull-refresh/);
  await page.evaluate(() => { (window as unknown as { marker: string }).marker = "kept"; });
  await drag(page, 100, 150, true);
  await expect(page.locator(".pull-chain")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe("kept");
});

test("if the page never hears the finger lift, the chain still goes away on its own and the page is not reloaded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await installedApp(page);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/has-pull-refresh/);
  await page.evaluate(() => { (window as unknown as { marker: string }).marker = "kept"; });
  await drag(page, 100, 260, false);   // planted, and no touchend ever arrives
  await expect(page.locator(".pull-chain")).toContainText("Release to refresh");
  await expect(page.locator(".pull-chain")).toHaveCount(0, { timeout: 8000 });
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe("kept");
});
