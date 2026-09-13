import assert from "node:assert/strict";
import test from "node:test";
import { retrySafeRead } from "../src/lib/retry-safe-read.ts";

test("retries a short-lived service failure before a player save", async () => {
  let calls = 0;
  const result = await retrySafeRead(async () => {
    calls += 1;
    return calls === 1 ? { error: { status: 503, message: "temporarily unavailable" } } : { error: null, value: "ready" };
  });
  assert.equal(calls, 2);
  assert.equal(result.error, null);
});

test("does not retry a legitimate validation response", async () => {
  let calls = 0;
  const result = await retrySafeRead(async () => {
    calls += 1;
    return { error: { status: 400, message: "That game has already started." } };
  });
  assert.equal(calls, 1);
  assert.equal(result.error.status, 400);
});
