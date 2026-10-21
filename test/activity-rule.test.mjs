import assert from "node:assert/strict";
import test from "node:test";
import { countsAsActivity } from "../src/lib/activity-rule.js";

test("any successful player authentication counts as being active", () => {
  assert.equal(countsAsActivity({ ok: true, player: { active: true } }), true);
  assert.equal(countsAsActivity({ ok: true, player: {} }), true);
});

test("failed sign-ins, inactive players and the Commissioner's background admin calls do not", () => {
  assert.equal(countsAsActivity({ ok: false }), false);
  assert.equal(countsAsActivity({ ok: true, player: { active: false } }), false);
  assert.equal(countsAsActivity({ ok: true, player: { active: true } }, { requireCommissioner: true }), false);
});
