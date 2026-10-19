import assert from "node:assert/strict";
import test from "node:test";
import { isSurvivorReminderApplicable } from "../src/lib/reminder-rules.js";

test("never treats Survivor as due once a champion is crowned", () => {
  assert.equal(isSurvivorReminderApplicable("regular", false), true);
  assert.equal(isSurvivorReminderApplicable("regular", true), false);
});

test("never treats Survivor as due during the playoffs", () => {
  assert.equal(isSurvivorReminderApplicable("regular"), true);
  assert.equal(isSurvivorReminderApplicable("playoff"), false);
});
