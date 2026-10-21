/**
 * How a hanging banner's cloth moves. The cloth is redrawn a few device pixels at a time, each row of it shifted sideways by `clothShift` and brightened
 * or shaded by `clothSheen`, so its edges, stitching and lettering all bend in one smooth, unbroken curve. The swing from the rod is part of the same
 * shift (a pendulum: nothing at the rod, most at the hem), so the picture is never rotated or resampled and stays sharp.
 *
 * `u` is how far down the cloth a row is: 0 at the rod, 1 at the free hem. `t` is time in seconds. Shifts are in banner units (the banner is 170 wide).
 */

/** Sideways shift of a row: a slow swing from the rod, plus a long wave running down the cloth with a shorter, slower one laid over it so it never repeats. */
export function clothShift(u, t) {
  const down = Math.max(0, Math.min(1, u));
  const reach = 0.25 + 5.2 * Math.pow(down, 1.6);
  const long = Math.sin(Math.PI * 2 * (t / 3.4 - 0.9 * down));
  const short = Math.sin(Math.PI * 2 * (t / 5.3 - 1.7 * down + 0.3));
  const swing = down * 4.2 * Math.sin(Math.PI * 2 * (t / 6.5));
  return swing + reach * (0.68 * long + 0.32 * short);
}

/** Light (positive) or shade (negative), from -1 to 1, on a row: where the cloth leans toward the light it brightens, where it leans away it darkens. */
export function clothSheen(u, t, depth) {
  const du = 0.01;
  const slope = (clothShift(u + du, t) - clothShift(u, t)) / (du * depth);   // sideways shift per unit of height
  return Math.max(-1, Math.min(1, slope * 7));
}
