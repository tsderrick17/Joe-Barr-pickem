/**
 * How a hanging banner's cloth moves. The cloth is redrawn a few device pixels at a time, each row of it shifted sideways by `clothShift` and brightened
 * or shaded by `clothSheen`, so its edges, stitching and lettering all bend in one smooth, unbroken curve. The swing from the rod is part of the same
 * shift (a pendulum: nothing at the rod, most at the hem), so the picture is never rotated or resampled and stays sharp.
 *
 * `u` is how far down the cloth a row is: 0 at the rod, 1 at the free hem. `t` is time in seconds. Shifts are in banner units (the banner is 170 wide).
 */

/** A banner that moves exactly as every banner once did: the reference for the tests and the shape of a feel. */
export const PLAIN_FEEL = { pace: 1, reach: 1, phase: 0, swingPhase: 0, gustDelay: 0, gusts: false };

const GOLDEN = 0.6180339887;
const wrap = (x) => ((x % 1) + 1) % 1;

/**
 * Each banner's own way of moving, so no two hang in step. `index` is its place in the row and `random` a number from 0 to 1 drawn once per visit.
 * Places are spread by the golden ratio, so neighbours always differ: in pace (its own rhythm, 0.86 to 1.14 times the usual), in how far it swings
 * (0.8 to 1 times), and where in its swing and wave it starts. `random` turns the whole row by the same amount, so every visit looks a little
 * different while neighbours stay apart. Gusts of wind cross the row from left to right, reaching each banner a moment after the one before.
 */
export function bannerFeel(index, random) {
  const spread = (k) => wrap(index * GOLDEN + k * 0.381966 + random);
  return { pace: 0.86 + 0.28 * spread(1), reach: 0.8 + 0.2 * spread(2), phase: spread(3), swingPhase: spread(4), gustDelay: index * 0.9, gusts: true };
}

/** How hard the wind blows at time `t` (0.85 to 1.05): two slow swells that rarely line up, so the breeze builds and fades without a pattern. */
export function gust(t) {
  const swell = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (t / 17)) * Math.sin(Math.PI * 2 * (t / 29) + 1);
  return 0.85 + 0.2 * swell;
}

/**
 * Sideways shift of a row: a slow swing from the rod, plus a long wave running down the cloth with a shorter, slower one laid over it so it never
 * repeats. `feel` (from `bannerFeel`) sets this banner's rhythm, reach, starting points and the gusts; without it the banner moves as `PLAIN_FEEL`.
 */
export function clothShift(u, t, feel = PLAIN_FEEL) {
  const down = Math.max(0, Math.min(1, u));
  const time = t * feel.pace;
  const strength = feel.reach * (feel.gusts ? gust(t - feel.gustDelay) : 1);
  const reach = 0.25 + 5.2 * Math.pow(down, 1.6);
  const long = Math.sin(Math.PI * 2 * (time / 3.4 - 0.9 * down + feel.phase));
  const short = Math.sin(Math.PI * 2 * (time / 5.3 - 1.7 * down + 0.3 + feel.phase * 1.7));
  const swing = down * 4.2 * Math.sin(Math.PI * 2 * (time / 6.5 + feel.swingPhase));
  return strength * (swing + reach * (0.68 * long + 0.32 * short));
}

/** Light (positive) or shade (negative), from -1 to 1, on a row: where the cloth leans toward the light it brightens, where it leans away it darkens. */
export function clothSheen(u, t, depth, feel = PLAIN_FEEL) {
  const du = 0.01;
  const slope = (clothShift(u + du, t, feel) - clothShift(u, t, feel)) / (du * depth);   // sideways shift per unit of height
  return Math.max(-1, Math.min(1, slope * 7));
}
