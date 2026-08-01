import assert from "node:assert/strict";
import test from "node:test";
import { runSeasonRecoveryRehearsal } from "../src/lib/season-recovery-rehearsal.js";

test("the safe season and recovery rehearsal passes every representative path", () => {
  const result = runSeasonRecoveryRehearsal();
  assert.equal(result.status, "healthy");
  assert.equal(result.checks.length, 5);
  assert.ok(result.checks.every((check) => check.passed));
});
