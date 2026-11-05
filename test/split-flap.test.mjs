import assert from "node:assert/strict";
import test from "node:test";
import { BOARD_PACE, digitPace, nextFlip } from "../src/lib/split-flap.js";

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

test("every digit on the board flips at the same speed, give or take 3%", () => {
  assert.equal(digitPace(BOARD_PACE, 0.5), BOARD_PACE);
  assert.ok(digitPace(BOARD_PACE, 0) >= BOARD_PACE * 0.97);
  assert.ok(digitPace(BOARD_PACE, 1) <= BOARD_PACE * 1.03);
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
