/**
 * The order to fetch the turntable's pictures in. The three resting views come first, then the pictures are filled in evenly all the way
 * round (every 10th, then every 5th, every 2nd, then the rest), so that a spin started before everything has arrived passes through
 * pictures that are evenly spread rather than a few close to each resting view and a gap in between.
 * @param {number} frames how many pictures there are in a full turn
 * @param {number} restFrames how many pictures apart the resting views are
 * @returns {number[]} every picture index once
 */
export function loadOrder(frames, restFrames) {
  const order = [];
  const seen = new Set();
  const add = (index) => { if (!seen.has(index)) { seen.add(index); order.push(index); } };
  for (let index = 0; index < frames; index += restFrames) add(index);
  for (const gap of [10, 5, 2, 1]) for (let index = 0; index < frames; index += gap) add(index);
  return order;
}
