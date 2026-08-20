import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("email reminders identify PickemJB as the visible sender", async () => {
  const source = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");
  assert.match(source, /sender: \{ name: "PickemJB", email: sender \}/);
});

test("Notifications shows the externally visible safe-sender address only after email opt-in", async () => {
  const source = await readFile(new URL("../src/app/profile/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/app/api/profile/route.ts", import.meta.url), "utf8");
  assert.match(source, /\{enabled \? <aside[^>]*>.*Keep PickemJB out of spam.*senderEmail.*as <span className="font-bold">PickemJB<\/span>.*appears as the sender.*<\/aside> : null\}/s);
  assert.match(route, /BREVO_PUBLIC_SENDER_EMAIL \?\? process\.env\.BREVO_SENDER_EMAIL/);
});
