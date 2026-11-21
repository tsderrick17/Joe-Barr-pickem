/**
 * How one split-flap digit on the Bowl Card moves, like a stadium board: each module has its own motor, so no two flip in
 * step: each digit runs at its own speed (within 10% of the board's), starts at its own moment, and every single flip catches
 * a little early or late (within 10%). Until results arrive the
 * digits flip on. Once told to land, each digit flips forward only as far as its number and stops there, the last
 * few flips slowing as the drum catches, so a digit with farther to go finishes later and the board settles raggedly.
 */

/** The board's flip speed in milliseconds per flip, when no speed is given. */
export const BOARD_PACE = 140;

/** One digit's speed: the board's, give or take its own motor's 10% (`wear` is a random number from 0 to 1). */
export function digitPace(pace, wear) {
  return pace * (0.9 + wear * 0.2);
}

/** One flip's length: the digit's pace, each flip catching a little early or late, within 10% (`hitch` is random from 0 to 1). */
export function flipJitter(duration, hitch) {
  return duration * (0.9 + hitch * 0.2);
}

/**
 * The digit's next move. `current` is what it shows; `landing` is whether results are in; `flipsSinceLanding`
 * counts the flips made since then, and `minFlips` is how many it must make before it may stop (a tap to flip
 * again makes one full turn of the drum). Returns `{ stop: true }`, or the next number and how long that flip takes.
 *
 * @param {{ current: number; target: number; landing: boolean; flipsSinceLanding: number; minFlips: number; pace: number }} state
 * @returns {{ stop: true } | { stop: false; next: number; duration: number }}
 */
export function nextFlip({ current, target, landing, flipsSinceLanding, minFlips, pace }) {
  if (landing && flipsSinceLanding >= minFlips && current === target) return { stop: true };
  const next = (current + 1) % 10;
  // Flips left to the number, this one included: a full turn when it shows its number but must still go round.
  const left = landing ? ((target - current + 9) % 10) + 1 : Infinity;
  // The last three flips slow down progressively, like the drum catching.
  const duration = pace * (left <= 3 ? 1 + (4 - left) * 0.35 : 1);
  return { stop: false, next, duration };
}
