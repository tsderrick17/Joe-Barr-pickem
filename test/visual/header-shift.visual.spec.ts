import { expect, test } from "@playwright/test";
import { signIn } from "./session";
import { homeResponse } from "./standings-fixtures.mjs";

// The header must not move when the signed-in player's name arrives a moment after the page: the brand stays exactly where it was and the bar keeps
// its height. Driven in a real browser with the account answer held back; no screenshots are compared.
for (const [name, width] of [["phone-390", 390], ["phone-360", 360], ["tablet-700", 700], ["desktop-1280", 1280]] as const) {
  test(`the header's brand stays put when the player's name arrives (${name})`, async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
    await page.route("**/api/home**", (route) => route.fulfill({ json: homeResponse("commissioner-playoff") }));
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/profile**", async (route) => { await gate; await route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }); });
    await page.route("https://placeholder.invalid/**", (route) => route.abort());
    await page.goto("/");
    const brand = page.locator(width < 768 ? ".mobile-account-nav a[href='/']" : ".site-nav-brand");
    await expect(brand).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    const before = await brand.evaluate((el) => { const r = el.getBoundingClientRect(); const bar = el.closest("nav")!.getBoundingClientRect(); return { top: r.top, left: r.left, barHeight: bar.height }; });
    release();
    await expect(page.getByRole("button", { name: /Tyler/ }).first()).toBeVisible();
    await page.waitForTimeout(400);
    const after = await brand.evaluate((el) => { const r = el.getBoundingClientRect(); const bar = el.closest("nav")!.getBoundingClientRect(); return { top: r.top, left: r.left, barHeight: bar.height }; });
    expect(after.top, "the brand did not move").toBeCloseTo(before.top, 1);
    expect(after.left).toBeCloseTo(before.left, 1);
    expect(after.barHeight, "the bar did not change height").toBeCloseTo(before.barHeight, 1);
  });
}
