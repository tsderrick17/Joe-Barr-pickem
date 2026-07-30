import { expect, test } from "@playwright/test";

const enabled = process.env.PICKEM_E2E_ENABLED === "true";

test.skip(!enabled, "Set PICKEM_E2E_ENABLED=true and point at the isolated test project.");

test("player login rejects an unknown PIN without leaving the sign-in screen", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("FOUR-DIGIT PIN").fill("0000");
  await page.getByRole("button", { name: "Enter Pick'em" }).click();
  await expect(page.getByText("That PIN was not recognized. Please try again.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
