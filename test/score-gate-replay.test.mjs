import assert from "node:assert/strict";
import test from "node:test";
import { nextScoreCheckAt } from "../src/lib/score-check-backoff.ts";
import { SCORE_GATE_INTERVAL_MINUTES, SCORE_RETRY_MINUTES } from "../src/lib/score-retry-ladder.js";
import { FIRST_SCORE_CHECK_DELAY_MINUTES } from "../src/lib/score-window.js";

// The score gate, replayed tick by tick. The database wakes the worker on a fixed clock (every SCORE_GATE_INTERVAL_MINUTES) and the gate
// (score_work_is_due) calls it only when a game is past its first-check time and has no retry timer still running. The worker starts a few
// seconds after the tick and stamps the retry timer. If the stamp came from the run's start instead of the tick, the timer would still be
// running a few seconds after the next tick, the game would skip it, and every gap would be one tick longer than the ladder says.
// Real production runs showed exactly that: "10-minute" gaps of 20 minutes.

const MINUTE = 60_000;
const TICK = SCORE_GATE_INTERVAL_MINUTES * MINUTE;
const kickoff = Date.parse("2026-11-08T18:00:00.000Z"); // every NFL kickoff is on a five-minute mark; so is every tick
const expectedMinutes = [FIRST_SCORE_CHECK_DELAY_MINUTES];
for (const gap of SCORE_RETRY_MINUTES) expectedMinutes.push(expectedMinutes.at(-1) + gap);

/**
 * Walk the clock forward one tick at a time until the game has had every check on the ladder.
 * @param {{ delaySeconds?: (check: number) => number, clockBehindSeconds?: number, manualRunAfterCheck?: { check: number, afterSeconds: number } }} [options]
 */
function replay({ delaySeconds = () => 4, clockBehindSeconds = 0, manualRunAfterCheck = null } = {}) {
  const checks = []; // { start (ms), tick (ms) }
  let backoff = null; // { attempts, nextCheckAt (ms) }
  const record = (startedAt) => {
    const attempts = (backoff?.attempts ?? 0) + 1;
    const stamped = nextScoreCheckAt(attempts, new Date(startedAt - clockBehindSeconds * 1000));
    backoff = { attempts, nextCheckAt: Date.parse(stamped) };
  };
  for (let tick = kickoff; checks.length < expectedMinutes.length; tick += TICK) {
    if (tick > kickoff + 72 * 60 * MINUTE) assert.fail("the replay never reached the end of the ladder");
    const evaluatedAt = tick + 50; // the gate reads the clock a moment after the schedule fires
    const due = tick >= kickoff + FIRST_SCORE_CHECK_DELAY_MINUTES * MINUTE && !(backoff && backoff.nextCheckAt > evaluatedAt);
    if (!due) continue;
    const start = tick + delaySeconds(checks.length + 1) * 1000;
    checks.push({ start, tick });
    record(start);
    if (manualRunAfterCheck && manualRunAfterCheck.check === checks.length) {
      // The Commissioner's button: a run of its own between ticks, which also stamps the timer.
      const manualAt = start + manualRunAfterCheck.afterSeconds * 1000;
      checks.push({ start: manualAt, tick: null });
      record(manualAt);
    }
  }
  return checks;
}

const minutesAfterKickoff = (checks) => checks.filter((check) => check.tick !== null).map((check) => (check.tick - kickoff) / MINUTE);

test("the gate and the ladder agree: every check lands on its planned minute, whatever the start delay under one tick", () => {
  for (const delay of [0, 4, 59, 120, SCORE_GATE_INTERVAL_MINUTES * 60 - 1]) {
    assert.deepEqual(minutesAfterKickoff(replay({ delaySeconds: () => delay })), expectedMinutes, `${delay} s after each tick`);
  }
});

test("the worker clock a couple of seconds behind the database's changes nothing while the run still starts after the tick", () => {
  assert.deepEqual(minutesAfterKickoff(replay({ delaySeconds: () => 4, clockBehindSeconds: 2 })), expectedMinutes);
});

test("a run that starts a full tick late costs that game one tick, once, and the ladder carries on from there", () => {
  const late = replay({ delaySeconds: (check) => (check === 3 ? SCORE_GATE_INTERVAL_MINUTES * 60 + 30 : 4) });
  const got = minutesAfterKickoff(late);
  assert.deepEqual(got.slice(0, 3), expectedMinutes.slice(0, 3));
  // The late run itself is counted at the tick it was called for; every later check is exactly one tick behind plan, with the ladder's own gaps.
  assert.deepEqual(got.slice(3), expectedMinutes.slice(3).map((minutes) => minutes + SCORE_GATE_INTERVAL_MINUTES));
});

test("never two checks in one tick, and never one before its planned minute", () => {
  for (const delay of [0, 4, 59, 120]) {
    const got = minutesAfterKickoff(replay({ delaySeconds: () => delay }));
    assert.equal(new Set(got).size, got.length, "no tick checks the game twice");
    got.forEach((minutes, index) => assert.ok(minutes >= expectedMinutes[index], `check ${index + 1} is not early`));
  }
});

test("a Commissioner run between ticks counts as a check of its own and never doubles up with the automatic one", () => {
  const checks = replay({ manualRunAfterCheck: { check: 2, afterSeconds: Math.floor(SCORE_GATE_INTERVAL_MINUTES * 30) } });
  const automatic = checks.filter((check) => check.tick !== null).map((check) => check.tick);
  assert.equal(new Set(automatic).size, automatic.length, "no tick checks the game twice");
  // The manual run moves the game up one rung, so the automatic check that follows is the third rung's gap after the tick before the manual run.
  const afterManual = automatic[2] - automatic[1];
  assert.ok(afterManual >= TICK, "the next automatic check is at least one tick later");
  assert.equal(afterManual % TICK, 0, "and it is still on the clock");
});
