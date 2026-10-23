import { expect, test, type Page } from "@playwright/test";

// The three email plans on the Notifications page: picking a plan sets the playoff toggles the way its card promises. No screenshots are compared.
async function open(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.parse("2099-01-01T00:00:00Z") / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "p2", exp: expiresAt, role: "authenticated" })}.visual`;
  const session = { access_token: accessToken, refresh_token: "visual", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: "p2", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await page.addInitScript((value) => { window.localStorage.setItem("sb-placeholder-auth-token", value); window.localStorage.setItem("pickem-theme", "day"); }, JSON.stringify(session));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/pool-chat**", (route) => route.fulfill({ json: { messages: [] } }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: {
    notificationEmail: "tyler@example.com", senderEmail: "pool@example.com", emailNotificationsEnabled: true,
    emailWeeklyEnabled: true, emailFinalLinesEnabled: false, emailSundayFinalLinesEnabled: true, emailEarlyLockEnabled: false,
    emailPickDueSundayEarlyEnabled: true, emailPickDueSundayAfternoonEnabled: true, emailPickDuePrimetimeEnabled: true,
    emailSundayEarlyRevealEnabled: false, emailSundayLateRevealEnabled: false, emailFeaturedWindowRevealEnabled: false,
    emailWeeklyRecapEnabled: true, emailPlayoffDayRecapEnabled: false, emailPlayoffPublicRevealEnabled: false,
    firstName: "Tyler", isCommissioner: false, showPoolChat: false,
  } }));
  await page.route("https://placeholder.invalid/**", (route) => route.abort());
  await page.goto("/profile");
  await expect(page.getByRole("button", { name: /Full Card/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /FINE-TUNE THE DETAILS/ }).click();   // open "fine-tune", where the individual toggles are
  await expect(page.locator("label", { hasText: "Daily playoff recap" })).toBeVisible();
}
const toggle = (page: Page, title: string) => page.locator("label", { hasText: title }).getByRole("checkbox");
const plan = (page: Page, name: string) => page.locator("button[aria-pressed]").filter({ has: page.locator("strong", { hasText: new RegExp(`^${name}$`) }) });

test("Essentials leaves the playoff emails off, Regular adds the daily playoff recap, and Full Card adds every public reveal as well", async ({ page }) => {
  await open(page);
  await plan(page, "Essentials").click();
  await expect(plan(page, "Essentials")).toHaveAttribute("aria-pressed", "true");
  await expect(toggle(page, "Daily playoff recap")).not.toBeChecked();
  await expect(toggle(page, "All playoff pick reveals")).not.toBeChecked();
  await plan(page, "Regular").click();
  await expect(plan(page, "Regular")).toHaveAttribute("aria-pressed", "true");
  await expect(toggle(page, "Daily playoff recap")).toBeChecked();
  await expect(toggle(page, "All playoff pick reveals")).not.toBeChecked();
  await plan(page, "Full Card").click();
  await expect(plan(page, "Full Card")).toHaveAttribute("aria-pressed", "true");
  await expect(toggle(page, "Daily playoff recap")).toBeChecked();
  await expect(toggle(page, "All playoff pick reveals")).toBeChecked();
});

test("changing a single playoff toggle moves the plan off the three presets, and the weekly recap stays on in every plan", async ({ page }) => {
  await open(page);
  for (const name of ["Essentials", "Regular", "Full Card"]) {
    await plan(page, name).click();
    await expect(toggle(page, "Weekly recap")).toBeChecked();
  }
  await plan(page, "Regular").click();
  await toggle(page, "All playoff pick reveals").check();
  await expect(plan(page, "Regular")).toHaveAttribute("aria-pressed", "false");
});
