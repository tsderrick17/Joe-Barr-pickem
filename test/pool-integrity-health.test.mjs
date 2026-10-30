import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {
  assessLinesReady,
  assessWeekHandoff,
  assessWeeklyRecap,
  GRADING_GRACE_MS,
  HANDOFF_GRACE_MS,
  LINE_LOCK_GRACE_MS,
  RECAP_GRACE_MS,
} from "../src/lib/pool-integrity-health.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const iso = (ms) => new Date(ms).toISOString();

// Sunday 2026-11-08 12:00 UTC is 7 AM Eastern: well before the day's games.
const NOW = Date.parse("2026-11-08T12:00:00Z");

test("a game past its lock time without an official line is reported, once the lock grace has passed", () => {
  const games = [{ id: "g1", status: "scheduled", line_lock_at: iso(NOW - LINE_LOCK_GRACE_MS - MINUTE) }];
  const missed = assessLinesReady({ now: NOW, games, lockedGameIds: new Set(), capturedLineGameIds: new Set(["g1"]) });
  assert.equal(missed.healthy, false);
  assert.deepEqual(missed.missedLock, ["g1"]);

  const justLocked = [{ id: "g1", status: "scheduled", line_lock_at: iso(NOW - 5 * MINUTE) }];
  assert.equal(assessLinesReady({ now: NOW, games: justLocked, lockedGameIds: new Set(), capturedLineGameIds: new Set() }).healthy, true, "the lock worker has a few minutes to act");
  assert.equal(assessLinesReady({ now: NOW, games, lockedGameIds: new Set(["g1"]), capturedLineGameIds: new Set() }).healthy, true, "a locked line settles it");
});

test("a game about to lock with no line ever captured is reported; one far from locking or disrupted is not", () => {
  const soon = [{ id: "g1", status: "scheduled", line_lock_at: iso(NOW + 2 * HOUR) }];
  const none = assessLinesReady({ now: NOW, games: soon, lockedGameIds: new Set(), capturedLineGameIds: new Set() });
  assert.equal(none.healthy, false);
  assert.deepEqual(none.noLineYet, ["g1"]);
  assert.equal(assessLinesReady({ now: NOW, games: soon, lockedGameIds: new Set(), capturedLineGameIds: new Set(["g1"]) }).healthy, true);

  const later = [{ id: "g2", status: "scheduled", line_lock_at: iso(NOW + 5 * HOUR) }];
  assert.equal(assessLinesReady({ now: NOW, games: later, lockedGameIds: new Set(), capturedLineGameIds: new Set() }).healthy, true, "lines for later games may still arrive");

  for (const status of ["postponed", "cancelled", "no_contest"]) {
    const disrupted = [{ id: "g3", status, line_lock_at: iso(NOW - 2 * HOUR) }];
    assert.equal(assessLinesReady({ now: NOW, games: disrupted, lockedGameIds: new Set(), capturedLineGameIds: new Set() }).healthy, true, status);
  }
});

test("the Tuesday recap is only reported missing after it was due plus its grace", () => {
  // The week settled Monday 2026-11-09 03:30 UTC (Sunday night Eastern); its recap is due Tuesday 6:30 AM Eastern.
  const settledAt = "2026-11-09T03:30:00Z";
  const dueAt = Date.parse("2026-11-10T11:30:00Z");

  assert.equal(assessWeeklyRecap({ now: dueAt - HOUR, settledAt, reminders: [] }).healthy, true, "not due yet");
  assert.equal(assessWeeklyRecap({ now: dueAt + RECAP_GRACE_MS - MINUTE, settledAt, reminders: [] }).healthy, true, "inside the grace");
  assert.deepEqual(assessWeeklyRecap({ now: dueAt + RECAP_GRACE_MS + MINUTE, settledAt, reminders: [] }), { healthy: false, reason: "recap_not_queued" });
  const stuck = [{ status: "scheduled", cancelled_at: null, suppression_reason: null }];
  assert.deepEqual(assessWeeklyRecap({ now: dueAt + RECAP_GRACE_MS + MINUTE, settledAt, reminders: stuck }), { healthy: false, reason: "recap_not_sent" });

  const late = dueAt + 2 * 24 * HOUR;
  assert.equal(assessWeeklyRecap({ now: late, settledAt, reminders: [{ status: "sent", cancelled_at: null, suppression_reason: null }] }).healthy, true);
  assert.equal(assessWeeklyRecap({ now: late, settledAt, reminders: [{ status: "cancelled", cancelled_at: iso(dueAt), suppression_reason: null }] }).healthy, true, "a deliberate cancellation is not an outage");
  assert.equal(assessWeeklyRecap({ now: late, settledAt, reminders: [{ status: "scheduled", cancelled_at: null, suppression_reason: "no audience" }] }).healthy, true);
  assert.equal(assessWeeklyRecap({ now: late, settledAt: null, reminders: [] }).healthy, true, "no settled week, nothing to recap");
});

test("a settled and graded week must hand over by its scheduled time plus grace", () => {
  // Last game of the week finalized Monday 2026-11-09 04:00 UTC: the handoff is Wednesday 3 AM Eastern = 08:00 UTC Nov 11.
  const finalizedAt = "2026-11-09T04:00:00Z";
  const games = [
    { status: "final", kickoff_at: "2026-11-08T18:00:00Z", finalized_at: "2026-11-08T21:30:00Z" },
    { status: "final", kickoff_at: "2026-11-09T00:15:00Z", finalized_at: finalizedAt },
  ];
  const rolloverAt = Date.parse("2026-11-11T08:00:00Z");
  const base = { active: true, games, pendingGradeCount: 0, nextKickoffAt: "2026-11-15T18:00:00Z" };

  assert.equal(assessWeekHandoff({ ...base, now: rolloverAt - HOUR }).healthy, true, "still waiting for the handoff time");
  assert.equal(assessWeekHandoff({ ...base, now: rolloverAt + HANDOFF_GRACE_MS - MINUTE }).healthy, true, "inside the grace");
  assert.deepEqual(assessWeekHandoff({ ...base, now: rolloverAt + HANDOFF_GRACE_MS + MINUTE }), { healthy: false, reason: "week_not_advanced" });

  const soonKickoff = { ...base, nextKickoffAt: "2026-11-09T20:00:00Z" };
  assert.deepEqual(assessWeekHandoff({ ...soonKickoff, now: Date.parse(finalizedAt) + HANDOFF_GRACE_MS + MINUTE }), { healthy: false, reason: "week_not_advanced" }, "a next kickoff under 24 hours away hands over at once");

  const graded = Date.parse(finalizedAt);
  assert.equal(assessWeekHandoff({ ...base, pendingGradeCount: 2, now: graded + GRADING_GRACE_MS - MINUTE }).healthy, true);
  assert.deepEqual(assessWeekHandoff({ ...base, pendingGradeCount: 2, now: graded + GRADING_GRACE_MS + MINUTE }), { healthy: false, reason: "grades_pending" });
});

test("the handoff probe leaves games still in progress, postponed games, empty weeks and an idle season to other signals", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  const settled = { status: "final", kickoff_at: "2026-11-08T18:00:00Z", finalized_at: "2026-11-08T21:30:00Z" };
  const base = { now, active: true, games: [settled], pendingGradeCount: 0, nextKickoffAt: null };
  assert.equal(assessWeekHandoff({ ...base, games: [settled, { status: "in_progress", kickoff_at: "2026-11-08T18:00:00Z", finalized_at: null }] }).healthy, true);
  assert.equal(assessWeekHandoff({ ...base, games: [settled, { status: "postponed", kickoff_at: "2026-11-08T18:00:00Z", finalized_at: null }] }).healthy, true);
  assert.equal(assessWeekHandoff({ ...base, games: [] }).healthy, true);
  assert.equal(assessWeekHandoff({ ...base, active: false }).healthy, true);
  assert.equal(assessWeekHandoff(base).healthy, false, "a settled week two weeks after its handoff is a real outage");
});

test("a probe answers 200 healthy, 503 unhealthy and 503 on error, and only a healthy answer may be cached", async () => {
  const { poolIntegrityResponse } = await import("../src/lib/pool-integrity-route.ts");
  const quietly = async (run) => {
    const original = console.error;
    console.error = () => undefined;
    try { return await run(); } finally { console.error = original; }
  };

  const healthy = await poolIntegrityResponse("probe", 900, async () => ({ healthy: true }));
  assert.equal(healthy.status, 200);
  assert.equal(healthy.headers.get("cache-control"), "public, max-age=0, s-maxage=900");
  assert.equal((await healthy.json()).status, "ok");

  const unhealthy = await quietly(() => poolIntegrityResponse("probe", 900, async () => ({ healthy: false, reason: "2 games without a line" })));
  assert.equal(unhealthy.status, 503);
  assert.equal(unhealthy.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(Object.keys(await unhealthy.json()).sort(), ["checkedAt", "status"], "no detail leaves the server");

  const failed = await quietly(() => poolIntegrityResponse("probe", 900, async () => { throw new Error("database unreachable"); }));
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("cache-control"), "no-store, max-age=0");
});
