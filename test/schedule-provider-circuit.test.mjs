import assert from "node:assert/strict";
import test from "node:test";
import { scheduleProviderCooldownMinutes } from "../src/lib/schedule-provider-backoff.js";

test("schedule provider failures back off past duplicate daily refresh windows", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 9].map(scheduleProviderCooldownMinutes),
    [120, 360, 720, 1_440, 1_440],
  );
});
