import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("email reminders identify PickemJB as the visible sender", async () => {
  const source = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");
  assert.match(source, /sender: \{ name: "PickemJB", email: sender \}/);
});
