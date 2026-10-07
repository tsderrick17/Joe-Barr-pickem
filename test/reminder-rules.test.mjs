import assert from "node:assert/strict";
import test from "node:test";
import { isSurvivorReminderApplicable } from "../src/lib/reminder-rules.js";

test("Survivor reminders apply only during the regular season", () => {
  assert.equal(isSurvivorReminderApplicable("regular"), true);
  assert.equal(isSurvivorReminderApplicable("playoff"), false);
  assert.equal(isSurvivorReminderApplicable("postseason"), false);
});
