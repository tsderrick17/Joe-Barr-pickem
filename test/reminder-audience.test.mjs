import assert from "node:assert/strict";
import test from "node:test";
import { isSurvivorReminderApplicable } from "../src/lib/reminder-rules.js";

test("never treats Survivor as due during the playoffs", () => {
  assert.equal(isSurvivorReminderApplicable("regular"), true);
  assert.equal(isSurvivorReminderApplicable("playoff"), false);
});
