import test from "node:test";
import assert from "node:assert/strict";
import { bowlDailyRecapAt, bowlGamedays, unpickedBowlReminderAt } from "../src/lib/bowl-email-schedule.js";
test("Bowl recap is 5 AM Eastern the following day", () => assert.equal(bowlDailyRecapAt("2026-12-15"), "2026-12-16T10:00:00.000Z"));
test("Bowl gamedays are unique", () => assert.deepEqual(bowlGamedays([{ kickoff_at: "2026-12-16T00:00:00Z" }, { kickoff_at: "2026-12-16T02:00:00Z" }]), ["2026-12-15"]));
test("unpicked reminder is three hours before kickoff", () => assert.equal(unpickedBowlReminderAt("2026-12-15T17:30:00.000Z"), "2026-12-15T14:30:00.000Z"));
