import assert from "node:assert/strict";
import test from "node:test";
import { automaticWeeklyRecapAt } from "../src/lib/weekly-recap-timing.js";

test("queues the major weekly recap beginning Tuesday at 8 AM Eastern", () => {
  assert.equal(automaticWeeklyRecapAt("2026-09-08T03:00:00.000Z"), "2026-09-08T12:00:00.000Z");
});

test("keeps the Tuesday morning time stable across daylight saving time", () => {
  assert.equal(automaticWeeklyRecapAt("2026-12-01T03:00:00.000Z"), "2026-12-01T13:00:00.000Z");
});

test("a result settling after Tuesday sends as soon as it is accurate", () => {
  assert.equal(automaticWeeklyRecapAt("2026-09-09T12:00:00.000Z"), "2026-09-08T12:00:00.000Z");
});
