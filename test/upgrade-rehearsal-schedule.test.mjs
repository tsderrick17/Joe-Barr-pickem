import assert from "node:assert/strict";
import test from "node:test";
import { parseNflverseGameDates } from "../src/lib/full-schedule-provider.js";
import { easternCalendarDate, selectUpgradeRehearsalDay } from "../src/lib/upgrade-rehearsal-schedule.js";

test("the rehearsal gate recognizes regular-season, playoff, and preseason gamedays", () => {
  const csv = [
    "game_id,season,game_type,gameday",
    "pre,2026,PRE,2026-08-01",
    "reg,2026,REG,2026-10-01",
    "post,2026,POST,2027-01-02",
  ].join("\n");
  assert.deepEqual([...parseNflverseGameDates(csv)], ["2026-08-01", "2026-10-01", "2027-01-02"]);
});

test("a scheduled rehearsal skips a gameday and runs on the next available non-gameday", () => {
  const gameDates = new Set(["2026-10-01", "2026-10-04"]);
  assert.deepEqual(
    selectUpgradeRehearsalDay({ eventName: "schedule", today: "2026-10-01", gameDates }),
    { run: false, reason: "nfl-gameday", date: "2026-10-01" },
  );
  assert.deepEqual(
    selectUpgradeRehearsalDay({ eventName: "schedule", today: "2026-10-02", gameDates }),
    { run: true, reason: "first-available-non-gameday", date: "2026-10-02" },
  );
});

test("playoff dates receive the same gameday protection", () => {
  const gameDates = new Set(["2027-01-02", "2027-01-03", "2027-01-04"]);
  assert.equal(selectUpgradeRehearsalDay({ eventName: "schedule", today: "2027-01-02", gameDates }).run, false);
  assert.equal(selectUpgradeRehearsalDay({ eventName: "schedule", today: "2027-01-05", gameDates }).run, true);
});

test("competitive months fail closed when the schedule feed has no coverage", () => {
  assert.throws(
    () => selectUpgradeRehearsalDay({ eventName: "schedule", today: "2026-09-01", gameDates: new Set() }),
    /no games for 2026-09/,
  );
  assert.equal(selectUpgradeRehearsalDay({ eventName: "schedule", today: "2026-06-01", gameDates: new Set() }).run, true);
});

test("manual rehearsals remain available and Eastern dates survive the UTC boundary", () => {
  assert.equal(selectUpgradeRehearsalDay({ eventName: "workflow_dispatch", today: "2026-10-01", gameDates: new Set() }).run, true);
  assert.equal(easternCalendarDate(new Date("2026-10-01T02:00:00Z")), "2026-09-30");
});
