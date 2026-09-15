import { expect, test } from "@playwright/test";

test.describe("rehearsal visual layout guard", () => {
  test("desktop slate keeps chipless team lanes aligned", async ({ page }) => {
    await page.goto("/preview");
    await page.getByRole("button", { name: "Slate" }).click();
    await expect(page.getByRole("heading", { name: /ATS SLATE/ })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const rightEdges = await page.locator(".slate-game-row:not(.is-final) .slate-team-label-lane.is-right").evaluateAll((nodes) => nodes.map((node) => Math.round((node as HTMLElement).getBoundingClientRect().left)));
    expect(rightEdges.length).toBeGreaterThan(3);
    expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThanOrEqual(1);
  });

  test("mobile rehearsal surfaces fit without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/preview");
    await page.getByRole("button", { name: "Pick'em Pad" }).click();
    await expect(page.locator("h1").filter({ hasText: "Pick'em Pad" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
