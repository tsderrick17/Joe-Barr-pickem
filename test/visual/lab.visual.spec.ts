import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./session";

// The Workshop Lab's try-outs, with sample data only. Each try-out's states get a picture.
const SIZES = { "phone-390": { width: 390, height: 844 }, "desktop-1280": { width: 1280, height: 800 } } as const;

async function openLab(page: Page, tryOut: string, { theme = "day", size = SIZES["phone-390"] }: { theme?: string; size?: { width: number; height: number } } = {}) {
  await page.setViewportSize(size);
  await signIn(page, theme);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => window.localStorage.setItem("commissioner-dial-hint", "3"));
  await page.route("**/api/**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile**", (route) => route.fulfill({ json: { firstName: "Tyler", isCommissioner: true, showPoolChat: false } }));
  await page.goto(`/admin/workshop/lab?try=${tryOut}`);
  await expect(page.getByRole("group", { name: "Try-outs" })).toBeVisible({ timeout: 30_000 });
}

async function holdStill(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; } .cw-dial { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }" });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.waitForTimeout(300);
}

for (const theme of ["day", "night"]) {
  for (const [label, size] of Object.entries(SIZES)) {
    for (const look of ["Today", "Refined"]) {
      for (const week of ["Saved", "Game day", "Graded"]) {
        if (look === "Today" && week !== "Saved") continue;   // today's look is already covered on the real pages
        test(`Lab ticket and receipt, ${look}, ${week}, ${theme} at ${label}`, async ({ page }) => {
          await openLab(page, "ticket", { theme, size });
          await page.getByRole("group", { name: "Look" }).getByRole("button", { name: look }).click();
          await page.getByRole("group", { name: "Week" }).getByRole("button", { name: week }).click();
          await holdStill(page);
          await expect(page.locator(".lab-family")).toHaveScreenshot(`lab-ticket-${look.toLowerCase()}-${week.toLowerCase().replace(/ /g, "-")}-${theme}-${label}.png`);
        });
      }
    }
  }
}

test("the ticket and receipt try-out switches between today's look and the refined family", async ({ page }) => {
  await openLab(page, "ticket");
  const family = page.locator(".lab-family");
  await expect(family).toHaveAttribute("data-look", "refined");
  await expect(family.getByRole("region", { name: "Your weekly receipt" })).toBeVisible();
  await expect(family.getByRole("region", { name: /Your current ticket/ })).toBeVisible();
  await page.getByRole("group", { name: "Look" }).getByRole("button", { name: "Today" }).click();
  await expect(family).toHaveAttribute("data-look", "today");
  await expect(family).not.toHaveClass(/ticket-family/);
});

test("the Lab remembers the try-out on this device and in the address", async ({ page }) => {
  await openLab(page, "feel");
  await expect(page.locator("[data-haptic-test]")).toBeVisible();
  await page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Ticket & receipt" }).click();
  await expect(page).toHaveURL(/try=ticket/);
  await page.goto("/admin/workshop/lab");
  await expect(page.locator(".lab-family")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Ticket & receipt" })).toHaveAttribute("aria-pressed", "true");
});
