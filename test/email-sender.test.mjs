import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("email reminders identify PickemJB as the visible sender", async () => {
  const source = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");
  assert.match(source, /sender: \{ name: "PickemJB", email: sender \}/);
});

test("Notifications shows the safe-sender address only after email opt-in", async () => {
  const source = await readFile(new URL("../src/app/profile/page.tsx", import.meta.url), "utf8");
  assert.match(source, /\{enabled \? <aside[^>]*>.*Keep PickemJB out of spam.*PickemJB.*senderEmail.*This is the pool’s delivery address.*<\/aside> : null\}/s);
});
