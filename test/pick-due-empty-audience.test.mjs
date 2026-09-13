import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("an empty Pick Due audience is a suppressed no-op, not a sent email", async () => {
  const [delivery, worker] = await Promise.all([
    readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/reminder-worker.ts", import.meta.url), "utf8"),
  ]);

  assert.match(delivery, /reminder\.category === "pick_due" && recipients\.length === 0/);
  assert.match(delivery, /No player has an outstanding Pick'em selection\./);
  assert.match(worker, /if \(emailDelivery\.suppressed\)/);
  assert.match(worker, /status: "suppressed"/);
});
