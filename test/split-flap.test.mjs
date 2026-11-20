import assert from "node:assert/strict";
import test from "node:test";
import { BOARD_PACE, digitPace, flipJitter, nextFlip } from "../src/lib/split-flap.js";

/** Flips a digit from `current` until it stops; returns the numbers it showed and each flip's length. */
function run({ current, target, minFlips = 0, pace = 100 }) {
  const shown = [];
  const durations = [];
  let flips = 0;
  for (;;) {
    const move = nextFlip({ current, target, landing: true, flipsSinceLanding: flips, minFlips, pace });
    if (move.stop) return { shown, durations };
    current = move.next;
    flips += 1;
    shown.push(current);
    durations.push(move.duration);
    assert.ok(flips <= 10, "never more than one turn of the drum");
  }
}

test("each digit runs on its own motor: its own speed within 10% of the board's, and every flip within 10% of that", () => {
  assert.ok(Math.abs(digitPace(BOARD_PACE, 0.5) - BOARD_PACE) < 1e-9);
  assert.ok(digitPace(BOARD_PACE, 0) >= BOARD_PACE * 0.9 - 1e-9);
  assert.ok(digitPace(BOARD_PACE, 1) <= BOARD_PACE * 1.1 + 1e-9);
  assert.ok(digitPace(BOARD_PACE, 0) < digitPace(BOARD_PACE, 1) * 0.85);   // two digits can differ by well over the old 3%
  assert.ok(Math.abs(flipJitter(100, 0.5) - 100) < 1e-9);
  assert.ok(flipJitter(100, 0) >= 90 - 1e-9 && flipJitter(100, 1) <= 110 + 1e-9);
});

test("a landing digit flips forward only as far as its number", () => {
  assert.deepEqual(run({ current: 3, target: 5 }).shown, [4, 5]);
  assert.deepEqual(run({ current: 8, target: 1 }).shown, [9, 0, 1]);
  assert.deepEqual(run({ current: 4, target: 4 }).shown, []);
});

test("a digit with farther to go finishes later", () => {
  const near = run({ current: 2, target: 3 }).durations.reduce((a, b) => a + b, 0);
  const far = run({ current: 2, target: 9 }).durations.reduce((a, b) => a + b, 0);
  assert.ok(far > near);
});

test("the last three flips slow down, the very last the most", () => {
  const { durations } = run({ current: 0, target: 6 });
  assert.deepEqual(durations.slice(0, 3), [100, 100, 100]);
  assert.ok(durations[3] < durations[4] && durations[4] < durations[5]);
});

test("a tap to flip again makes one full turn and lands on the same number", () => {
  const { shown } = run({ current: 7, target: 7, minFlips: 1 });
  assert.deepEqual(shown, [8, 9, 0, 1, 2, 3, 4, 5, 6, 7]);
});

test("before results arrive the digit keeps flipping at full speed", () => {
  const move = nextFlip({ current: 9, target: 9, landing: false, flipsSinceLanding: 0, minFlips: 0, pace: 100 });
  assert.deepEqual(move, { stop: false, next: 0, duration: 100 });
});
