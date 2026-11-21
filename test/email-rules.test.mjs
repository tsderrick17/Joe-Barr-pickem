import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// The email rules that each needed only a test or two, kept together. Each block is one rule's tests, named for the file it came from.

// email-plan-insert-only
{
  test("automatic email planning inserts only missing occurrences without a partial-index upsert", async () => {
    const source = await readFile(new URL("../src/lib/automatic-email-plan.ts", import.meta.url), "utf8");
    assert.match(source, /const missingRows = rows\.filter\(\(row\) => !existingKeys\.has\(row\.automation_key\)\)/);
    assert.match(source, /\.insert\(missingRows\)/);
    assert.doesNotMatch(source, /\.upsert\(rows, \{ onConflict: "automation_key"/);
    assert.match(source, /error\?\.code === "23505"/);
  });
}

// email-renderer-contract
{
  test("email recaps use one safe image contract across every artwork type", async () => {
    const reminders = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");
    const renderer = await readFile(new URL("../src/lib/email-artwork.tsx", import.meta.url), "utf8");

    assert.match(reminders, /function recapImage\(/);
    assert.equal((reminders.match(/recapImage\(/g) ?? []).length >= 8, true);
    assert.match(reminders, /box-sizing:border-box;[^\"]*width:100%/);
    assert.match(reminders, /recap-image\?reminder=.*&kind=\$\{kind\}&v=5/);
    assert.match(reminders, /publicReceiptImageFrameStyle = "[^"]*max-width:560px/);
    assert.match(renderer, /safePublicRows/);
    assert.match(renderer, /const WIDTH = 760/);
    assert.match(renderer, /flex: "1 1 0%"/);
    assert.match(renderer, /alignTwoPicks/);
    assert.match(renderer, /picks\.length >= 6 \? 3/);
    const recapRoute = await readFile(new URL("../src/app/api/recap-image/route.tsx", import.meta.url), "utf8");
    assert.match(recapRoute, /artworkCacheKey/);
    assert.match(recapRoute, /MAX_CACHED_ARTWORKS = 32/);
    assert.match(recapRoute, /CACHE_TTL_MS/);
  });
}

// email-sender
{
  test("email reminders identify PickemJB as the visible sender", async () => {
    const source = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");
    assert.match(source, /sender: \{ name: "PickemJB", email: sender \}/);
  });

  test("Notifications shows the externally visible safe-sender address only after email opt-in", async () => {
    const source = await readFile(new URL("../src/components/notification-settings.tsx", import.meta.url), "utf8");
    const route = await readFile(new URL("../src/app/api/profile/route.ts", import.meta.url), "utf8");
    assert.match(source, /\{enabled \? <aside[^>]*>.*Keep PickemJB out of spam.*senderEmail.*as <span className="font-bold">PickemJB<\/span>.*appears as the sender.*<\/aside> : null\}/s);
    assert.match(route, /BREVO_PUBLIC_SENDER_EMAIL \?\? process\.env\.BREVO_SENDER_EMAIL/);
  });

  test("shared email footer keeps only the notification link without pool-membership claims", async () => {
    const source = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /You received this because you are active in the Bowl Pool/);
    assert.match(source, /Change your choices in Notifications/);
  });
}
