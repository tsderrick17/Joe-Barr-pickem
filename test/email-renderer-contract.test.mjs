import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(renderer, /flexWrap: "wrap"/);
  assert.match(renderer, /flex: "1 1 0%"/);
  assert.match(renderer, /alignTwoPicks/);
});
