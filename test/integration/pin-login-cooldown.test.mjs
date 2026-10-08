import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { createIsolatedClients, isolatedTestConfig } from "./test-supabase.mjs";

const config = isolatedTestConfig();
const skip = !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests.";

// pin_login_cooldown_seconds, run for real: how long a source must wait, from how many recent failed attempts it made.
// 5 in 15 minutes: one minute after the last. 10 in 15 minutes: fifteen minutes after the last. Counted per source.
const fingerprint = () => randomBytes(32).toString("hex");
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

async function attempts(admin, source, count, minutes) {
  const rows = Array.from({ length: count }, () => ({ source_fingerprint: source, pin_fingerprint: fingerprint(), attempted_at: minutesAgo(minutes) }));
  const { error } = await admin.from("pin_login_attempts").insert(rows);
  assert.equal(error, null, error?.message);
}
async function cooldown(admin, source) {
  const { data, error } = await admin.rpc("pin_login_cooldown_seconds", { attempt_source_fingerprint: source });
  assert.equal(error, null, error?.message);
  return data;
}

test("PIN failures cool a source down progressively, per source, and old failures stop counting", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const sources = Array.from({ length: 8 }, fingerprint);
  try {
    const [fresh, four, five, fiveOld, ten, tenOld, neighbor] = sources;
    await attempts(admin, four, 4, 0.1);
    assert.equal(await cooldown(admin, fresh), 0, "no attempts, no wait");
    assert.equal(await cooldown(admin, four), 0, "four recent failures are still free");

    await attempts(admin, five, 5, 0.1);
    const afterFive = await cooldown(admin, five);
    assert.ok(afterFive > 50 && afterFive <= 60, `five recent failures wait about a minute (got ${afterFive})`);
    assert.equal(await cooldown(admin, neighbor), 0, "another source is unaffected");

    await attempts(admin, fiveOld, 5, 2);
    assert.equal(await cooldown(admin, fiveOld), 0, "five failures whose minute has passed wait no longer");

    await attempts(admin, ten, 10, 1);
    const afterTen = await cooldown(admin, ten);
    assert.ok(afterTen > 13 * 60 && afterTen <= 14 * 60 + 1, `ten recent failures wait fifteen minutes from the last (got ${afterTen})`);

    await attempts(admin, tenOld, 10, 16);
    assert.equal(await cooldown(admin, tenOld), 0, "failures older than fifteen minutes no longer count");

    const { error } = await admin.rpc("pin_login_cooldown_seconds", { attempt_source_fingerprint: "not-a-fingerprint" });
    assert.ok(error, "a malformed source is refused");

  } finally {
    await admin.from("pin_login_attempts").delete().in("source_fingerprint", sources);
  }
});
