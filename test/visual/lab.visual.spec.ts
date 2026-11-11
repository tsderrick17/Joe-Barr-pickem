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
          await expect(page.locator(".lab-family")).toHaveScreenshot(`lab-ticket-${look.toLowerCase()}-${week.toLowerCase().replace(/ /g, "-")}-${theme}-${label}.png`, { maxDiffPixels: 12 });   // the small Survivor chip logo renders a few pixels differently from run to run
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

for (const theme of ["day", "night"]) {
  for (const [label, size] of Object.entries(SIZES)) {
    for (const week of ["Week 3", "Week 7", "Week 9"]) {
      test(`Lab Survivor table, ${week}, ${theme} at ${label}`, async ({ page }) => {
        await openLab(page, "survivor", { theme, size });
        await page.getByRole("group", { name: "Week" }).getByRole("button", { name: week }).click();
        await holdStill(page);
        await expect(page.locator(".lab-survivor-room")).toHaveScreenshot(`lab-survivor-${week.toLowerCase().replace(/ /g, "-")}-${theme}-${label}.png`, { maxDiffPixels: 12 });
      });
    }
  }
}

test("Lab Survivor table: a seat's weeks fanned out", async ({ page }) => {
  await openLab(page, "survivor");
  await page.getByRole("button", { name: /^Marge/ }).click();
  const sheet = page.getByRole("dialog", { name: "Marge's weeks" });
  await expect(sheet.locator(".lab-fan li")).toHaveCount(7);   // six wins, then the loss in week 7
  await expect(sheet.locator(".lab-fan li.is-lost")).toHaveCount(1);
  await holdStill(page);
  await expect(sheet).toHaveScreenshot("lab-survivor-seat-sheet-day-phone-390.png", { maxDiffPixels: 12 });
});

test("Lab Survivor table: the felt shows this week's chips, sweeps a losing team, and List shows the same league", async ({ page }) => {
  await openLab(page, "survivor");
  await page.getByRole("group", { name: "Week" }).getByRole("button", { name: "Week 3" }).click();
  await expect(page.getByRole("img", { name: "Bengals: Hank, lost" })).toBeVisible();   // Hank's Bengals lost in week 3
  await expect(page.locator(".lab-box.is-swept")).toHaveCount(2);   // the Bengals and the Dolphins
  await expect(page.locator(".lab-seat.is-out")).toHaveCount(3);   // Gus (week 2), Hank and Bev (week 3)
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "List" }).click();
  await expect(page.locator(".survivor-standings-row")).toHaveCount(10);
  await expect(page.locator(".lab-felt")).toHaveCount(0);
});

// Lamp-lit: the night look as a lounge after dark. A night mode, so by day it changes nothing but a note saying so.
for (const [label, size] of Object.entries(SIZES)) {
  for (const tryOut of ["survivor", "ticket"]) {
    test(`Lab lamp-lit ${tryOut}, night at ${label}`, async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem("pickem-lab-lamp", "on"));
      await openLab(page, tryOut, { theme: "night", size });
      await expect(page.locator(".lab-stage.is-lamp")).toBeVisible();
      await expect(page.locator(".lab-lamp-note")).toBeHidden();
      await holdStill(page);
      await expect(page.locator(".lab-stage")).toHaveScreenshot(`lab-lamp-${tryOut}-night-${label}.png`, { maxDiffPixels: 12 });
    });
  }
}

test("Lamp-lit is remembered, and by day it only shows a note", async ({ page }) => {
  await openLab(page, "survivor");
  const lamp = page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Lamp-lit" });
  await expect(lamp).toHaveAttribute("aria-pressed", "false");
  await lamp.click();
  await expect(page.getByText("Lamp-lit shows in night mode")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Try-outs" }).getByRole("button", { name: "Lamp-lit" })).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
});
