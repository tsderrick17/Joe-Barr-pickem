import "../test/helpers/typescript-renderer.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Fixture-only browser check. No production accounts, database, or email sends.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "build-only-secret-key";
const { emailArtworkSample } = await import("../src/lib/email-artwork-sample.ts");
const { renderEmailArtwork } = await import("../src/lib/email-artwork.tsx");
const { emailArtworkKinds } = await import("../src/lib/email-artwork-options.ts");
const { messageHtml } = await import("../src/lib/email-reminders.ts");
const { reminderTemplates } = await import("../src/lib/reminder-templates.ts");
const browser = await chromium.launch({ headless: true, ...(process.env.EMAIL_CHECK_BROWSER ? { channel: process.env.EMAIL_CHECK_BROWSER } : {}) });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let saved;
await page.addInitScript(() => localStorage.setItem("sb-example-auth-token", JSON.stringify({ access_token: "fixture-token", refresh_token: "fixture-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "fixture-user" } })));
await page.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/api/admin/reminders/preview") {
    const input = route.request().postDataJSON();
    const template = reminderTemplates.find((item) => item.id === input.templateId) ?? reminderTemplates.find((item) => item.id === "weekly_recap");
    const snapshot = emailArtworkSample(template.category);
    const images = [];
    let html = messageHtml({ id: "fixture", category: template.category, audience: template.audience, title: input.title ?? template.title, body: input.message ?? template.body, recap_snapshot: snapshot, imageOptions: input.imageOptions });
    for (const kind of emailArtworkKinds(template.category, snapshot)) {
      const rendered = await renderEmailArtwork(snapshot, kind, input.imageOptions);
      const src = "data:image/png;base64," + Buffer.from(await rendered.arrayBuffer()).toString("base64");
      images.push({ kind, src });
      html = html.replace(new RegExp('https://pickemjb\\.vercel\\.app/api/recap-image\\?[^"]*&kind=' + kind + '&[^"]*', "g"), src);
    }
    assert.ok(!html.includes("/api/recap-image?"), "All image URLs must be replaced with rendered PNGs");
    return route.fulfill({ json: { html, images, source: "Sample data · fictional players and results", warning: "", templateId: template.id } });
  }
  if (path === "/api/admin/reminder-templates") {
    if (route.request().method() === "PUT") saved = route.request().postDataJSON();
    return route.fulfill({ json: { templates: [], message: "Saved" } });
  }
  if (path === "/api/profile") return route.fulfill({ json: { player: { id: "fixture-user", first_name: "Commissioner", is_commissioner: true, active: true } } });
  if (path === "/api/admin/reminders") return route.fulfill({ json: { reminders: [] } });
  return route.fulfill({ json: {} });
});
try {
  await page.goto("http://127.0.0.1:3117/admin/reminders");
  const iframe = page.frameLocator('iframe[title="Actual email and image preview"]');
  await iframe.locator("img").first().waitFor();
  await page.waitForFunction(() => {
    const doc = document.querySelector("iframe")?.contentDocument;
    return doc && [...doc.images].every((image) => image.complete && image.naturalWidth > 0);
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Phone page must not overflow");
  assert.equal(await iframe.locator("body").evaluate((body) => body.scrollWidth > body.clientWidth), false, "Phone email must not overflow");
  await mkdir("test-results/email-artwork", { recursive: true });
  await page.locator("#email-artwork-studio").screenshot({ path: "test-results/email-artwork/studio-phone.png" });
  await page.getByLabel("Image spacing").selectOption("comfortable");
  assert.equal(await page.getByRole("button", { name: "Save email changes" }).isDisabled(), true);
  await page.getByRole("button", { name: "Refresh preview", exact: true }).click();
  await page.getByRole("button", { name: "Save email changes" }).click();
  await page.getByRole("status").filter({ hasText: "Saved for future emails" }).waitFor();
  assert.equal(saved.imageOptions.density, "comfortable");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Desktop", exact: true }).click();
  await page.locator("#email-artwork-studio").screenshot({ path: "test-results/email-artwork/studio-desktop.png" });
  assert.deepEqual(errors, []);
  console.log("Phone and desktop preview, PNG loading, overflow and save checks passed.");
} finally { await browser.close(); }
