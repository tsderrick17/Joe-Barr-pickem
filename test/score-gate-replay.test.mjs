import assert from "node:assert/strict";
import test from "node:test";
import { isTierCheckDue, nextScoreCheckTime, SCORE_TIERS, tierCheckOffsets } from "../src/lib/score-polling-tier.js";
import { SCORE_GATE_INTERVAL_MINUTES } from "../src/lib/score-retry-ladder.js";
import { FIRST_SCORE_CHECK_DELAY_MINUTES } from "../src/lib/score-window.js";

// The score gate, replayed tick by tick, with the worker's own decisions in the loop. The database wakes the worker on a fixed clock (every
// SCORE_GATE_INTERVAL_MINUTES) and the gate (score_work_is_due) calls it only when a game is past its first-check time and has no retry timer
// still running. The worker starts a few seconds after the tick, asks the tier whether the game's next time has come (isTierCheckDue), and
// either checks it or passes it over, and in both cases sets the retry timer to the game's next time on the tier (nextScoreCheckTime).
// If the timer were stamped from the run's own start instead of the tick, it would still be running a few seconds after the next tick, the
// game would skip it, and every gap would be one tick longer than the ladder says. Real production runs showed exactly that: "10-minute" gaps of 20.

const MINUTE = 60_000;
const TICK = SCORE_GATE_INTERVAL_MINUTES * MINUTE;
const kickoff = Date.parse("2026-11-08T18:00:00.000Z"); // every NFL kickoff is on a five-minute mark; so is every tick
const planned = (tier) => tierCheckOffsets(tier);

/**
 * Walk the clock forward one tick at a time until the game has had every check on its tier's list.
 * `tierAt(tick)` is the tier in force at a tick (it may change mid-game); with `untilHours` it keeps going that long after kickoff instead of
 * stopping at the last check, to see what the gate does next.
 * @param {{ tier?: string, tierAt?: (tick: number) => string, delaySeconds?: (check: number) => number, clockBehindSeconds?: number, manualRunAfterCheck?: { check: number, afterSeconds: number }, untilHours?: number }} [options]
 */
function replay({ tier = "normal", tierAt = () => tier, delaySeconds = () => 4, clockBehindSeconds = 0, manualRunAfterCheck = null, untilHours = 0 } = {}) {
  const checks = []; // real checks: { start (ms), tick (ms, null for a manual run) }
  const wakeups = []; // every run of the worker for this game, checked or passed over
  let backoff = null; // { lastCheckedMs, nextCheckAt (ms) }
  const stamp = (worker, atTier, checked) => {
    backoff = { lastCheckedMs: checked ? worker : backoff?.lastCheckedMs ?? null, nextCheckAt: Date.parse(nextScoreCheckTime(atTier, kickoff, worker)) };
  };
  const target = planned(tier).length;
  const automaticChecks = () => checks.filter((check) => check.tick !== null).length;
  for (let tick = kickoff; untilHours ? tick <= kickoff + untilHours * 60 * MINUTE : automaticChecks() < target; tick += TICK) {
    if (tick > kickoff + 72 * 60 * MINUTE && !untilHours) assert.fail("the replay never reached the end of the ladder");
    const evaluatedAt = tick + 50; // the gate reads the clock a moment after the schedule fires
    const due = tick >= kickoff + FIRST_SCORE_CHECK_DELAY_MINUTES * MINUTE && !(backoff && backoff.nextCheckAt > evaluatedAt);
    if (!due) continue;
    const start = tick + delaySeconds(checks.length + 1) * 1000;
    const worker = start - clockBehindSeconds * 1000;
    const atTier = tierAt(tick);
    const checked = atTier !== "paused" && isTierCheckDue(atTier, kickoff, backoff?.lastCheckedMs ?? null, worker);
    wakeups.push({ tick, checked });
    if (checked) checks.push({ start, tick });
    stamp(worker, atTier, checked);
    if (checked && manualRunAfterCheck && manualRunAfterCheck.check === checks.length) {
      // The Commissioner's button: a run of its own between ticks, which checks whatever the tier says and also stamps the timer.
      const manualAt = start + manualRunAfterCheck.afterSeconds * 1000;
      checks.push({ start: manualAt, tick: null });
      stamp(manualAt, atTier, true);
    }
  }
  return { checks, wakeups };
}

const minutesAfterKickoff = (checks) => checks.filter((check) => check.tick !== null).map((check) => (check.tick - kickoff) / MINUTE);
const wakeupMinutes = (wakeups) => wakeups.map((wake) => (wake.tick - kickoff) / MINUTE);

test("the gate and each tier agree: every check lands on its planned minute, whatever the start delay under one tick", () => {
  for (const tier of SCORE_TIERS) {
    for (const delay of [0, 4, 59, 120, SCORE_GATE_INTERVAL_MINUTES * 60 - 1]) {
      assert.deepEqual(minutesAfterKickoff(replay({ tier, delaySeconds: () => delay }).checks), planned(tier), `${tier}, ${delay} s after each tick`);
    }
  }
});

test("Normal is the ladder the owner approved: 175 and 5-minute checks to 210, then 220, 230, 250, 270, 290, 350, 470, 710", () => {
  assert.deepEqual(planned("normal"), [175, 180, 185, 190, 195, 200, 205, 210, 220, 230, 250, 270, 290, 350, 470, 710]);
  assert.deepEqual(planned("lean"), [175, 190, 205, 220, 235, 250, 265, 325, 445, 685]);
  assert.deepEqual(planned("minimal"), [190, 210, 230, 250, 310, 430, 670]);
});

test("a tier that starts after the gate's 175 minutes costs the worker one look and no credits, and then the gate stays quiet until the check", () => {
  const { checks, wakeups } = replay({ tier: "minimal" });
  assert.deepEqual(minutesAfterKickoff(checks), planned("minimal"));
  assert.deepEqual(wakeupMinutes(wakeups), [175, ...planned("minimal")], "one pass-over at 175, then only the planned checks");
  assert.equal(wakeups[0].checked, false);
});

test("the worker clock a couple of seconds behind the database's changes nothing while the run still starts after the tick", () => {
  for (const tier of SCORE_TIERS) assert.deepEqual(minutesAfterKickoff(replay({ tier, delaySeconds: () => 4, clockBehindSeconds: 2 }).checks), planned(tier));
});

test("a run that starts a full tick late stands in for the check due while it waited, and the list carries on exactly on plan", () => {
  // The third check's run starts five and a half minutes after its tick, so it is the run that serves the 190-minute time as well: one check
  // fewer, nothing doubled, and every later check still on its planned minute (the list is anchored to kickoff, not to the last run).
  const late = replay({ delaySeconds: (check) => (check === 3 ? SCORE_GATE_INTERVAL_MINUTES * 60 + 30 : 4), untilHours: 72 });
  assert.deepEqual(minutesAfterKickoff(late.checks), planned("normal").filter((minutes) => minutes !== 190));
});

test("never two checks in one tick, and never one before its planned minute", () => {
  for (const tier of SCORE_TIERS) {
    for (const delay of [0, 4, 59, 120]) {
      const got = minutesAfterKickoff(replay({ tier, delaySeconds: () => delay }).checks);
      assert.equal(new Set(got).size, got.length, `${tier}: no tick checks the game twice`);
      got.forEach((minutes, index) => assert.ok(minutes >= planned(tier)[index], `${tier}: check ${index + 1} is not early`));
    }
  }
});

test("a Commissioner run between ticks is a check of its own and never doubles up with, or moves, the automatic one", () => {
  for (const tier of SCORE_TIERS) {
    const { checks } = replay({ tier, manualRunAfterCheck: { check: 2, afterSeconds: Math.floor(SCORE_GATE_INTERVAL_MINUTES * 30) } });
    const automatic = minutesAfterKickoff(checks);
    assert.deepEqual(automatic, planned(tier), `${tier}: the automatic checks keep their planned minutes`);
    assert.equal(checks.length, planned(tier).length + 1, `${tier}: the manual run is one extra check`);
  }
});

test("after a tier's last check a game is not checked again by the gate, for as long as polling would run", () => {
  for (const tier of SCORE_TIERS) {
    assert.deepEqual(minutesAfterKickoff(replay({ tier, untilHours: 72 }).checks), planned(tier), `${tier}: the last automatic check is the list's last, and nothing follows it`);
  }
});

test("a game switching from Normal to Minimal mid-ladder goes straight to Minimal's next time: nothing skipped, nothing repeated", () => {
  // Normal until the 200-minute check, then Minimal from the tick at 205.
  const { checks, wakeups } = replay({ tierAt: (tick) => (tick < kickoff + 205 * MINUTE ? "normal" : "minimal"), untilHours: 72 });
  assert.deepEqual(minutesAfterKickoff(checks), [175, 180, 185, 190, 195, 200, 210, 230, 250, 310, 430, 670]);
  assert.deepEqual(wakeups.filter((wake) => !wake.checked).map((wake) => (wake.tick - kickoff) / MINUTE), [205], "the one pass-over at the switch");
});

test("a game switching from Minimal back up to Lean is checked at once if a Lean time has already passed, then follows Lean's list", () => {
  const { checks } = replay({ tierAt: (tick) => (tick < kickoff + 225 * MINUTE ? "minimal" : "lean"), untilHours: 72 });
  // Minimal's 190 and 210; at the 230 wake-up Lean's 220 has passed, so the game is checked then; Lean's next time after that is 235.
  assert.deepEqual(minutesAfterKickoff(checks), [190, 210, 230, 235, 250, 265, 325, 445, 685]);
});

test("while polling is paused the worker looks at the game once an hour and checks nothing; the first look after it clears checks it", () => {
  const { checks, wakeups } = replay({ tierAt: (tick) => (tick < kickoff + 400 * MINUTE ? "normal" : "paused"), untilHours: 12 });
  assert.deepEqual(minutesAfterKickoff(checks), planned("normal").filter((minutes) => minutes <= 350));
  const pausedWakes = wakeups.filter((wake) => wake.tick >= kickoff + 400 * MINUTE).map((wake) => (wake.tick - kickoff) / MINUTE);
  assert.ok(pausedWakes.every((minutes, index) => index === 0 || minutes - pausedWakes[index - 1] === 60), "an hour apart");
  assert.ok(wakeups.filter((wake) => wake.tick >= kickoff + 400 * MINUTE).every((wake) => !wake.checked));
  // And once the balance recovers (a new month) the game is simply checked again at its next time.
  const resumed = replay({ tierAt: (tick) => (tick < kickoff + 400 * MINUTE || tick >= kickoff + 600 * MINUTE ? "normal" : "paused"), untilHours: 72 });
  assert.ok(minutesAfterKickoff(resumed.checks).some((minutes) => minutes >= 600), "checking resumes after the pause");
});
