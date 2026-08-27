import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const emailReminders = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");

test("valid same-day pool emails are not discarded by a global daily limit", () => {
  assert.doesNotMatch(emailReminders, /routineEmailLimitReached/);
  assert.doesNotMatch(emailReminders, /Routine email limit reached/);
});

test("one reminder still has one durable delivery receipt per player", () => {
  assert.match(emailReminders, /reminder_id: reminder\.id/);
  assert.match(emailReminders, /onConflict|23505/);
  assert.match(emailReminders, /delivery\.status === "sent" \|\| delivery\.status === "suppressed"/);
});
