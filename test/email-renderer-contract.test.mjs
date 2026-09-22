import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("email recaps use one safe image contract across every artwork type", async () => {
  const reminders = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../src/app/api/recap-image/route.tsx", import.meta.url), "utf8");

  assert.match(reminders, /function recapImage\(/);
  assert.equal((reminders.match(/recapImage\(/g) ?? []).length >= 8, true);
  assert.match(reminders, /box-sizing:border-box;[^\"]*width:100%/);
  assert.match(reminders, /recap-image\?reminder=.*&kind=\$\{kind\}&v=3/);
  assert.match(reminders, /publicReceiptImageFrameStyle = "[^"]*max-width:440px/);
  assert.match(renderer, /safePublicRows/);
  assert.match(renderer, /const PUBLIC_RECEIPT_IMAGE_WIDTH = 760/);
  assert.match(renderer, /const RECAP_IMAGE_WIDTH = 760/);
  assert.match(renderer, /maxDuration = 30/);
  assert.match(renderer, /IMAGE_CACHE_CONTROL/);
  assert.match(renderer, /recap image render failed/);
  assert.match(renderer, /Pick&apos;em Update/);
});
