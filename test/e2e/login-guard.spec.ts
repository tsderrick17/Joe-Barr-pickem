import { expect, test } from "@playwright/test";

const enabled = process.env.PICKEM_E2E_ENABLED === "true";

test.skip(!enabled, "Set PICKEM_E2E_ENABLED=true and point at the isolated test project.");

test("player login rejects an unknown PIN without leaving the sign-in screen", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("FOUR-DIGIT PIN").fill("0000");
  await page.getByRole("button", { name: "Enter Pick'em" }).click();
  // Supabase intentionally does password work even for an unknown account so
  // that login timing does not reveal which PINs exist. Leave enough room for
  // that protection on the isolated project instead of treating it as a UI
  // failure.
  await expect(
    page.getByText("That PIN was not recognized. Please try again."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/login$/);
});
