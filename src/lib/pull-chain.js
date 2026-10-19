/**
 * The drawing math for the pull-down-to-refresh first-down chain. The two rods stand on the ground with a chain between their feet:
 * the rear rod is planted at the left, and the lead rod is carried out of the top of the header at an angle, swinging upright and
 * dragging the chain taut until its rubber foot plants (that is the signal to release). Kept as plain functions so the picture can be
 * checked without a browser.
 */
export const WIDTH = 220;
export const REAR_X = 26;           // where the rear rod stands
export const LEAD_FROM = 64;        // where the lead rod enters, and where it ends up planted (LEAD_TO)
export const LEAD_TO = 188;
export const CHAIN_LENGTH = LEAD_TO - REAR_X;   // exactly the gap once the lead rod has planted, so the chain is taut then
export const FOOT = 6;              // the rubber stopper at the bottom of a rod
const RING = 3.5;                   // the chain is fastened this far above the bottom of the rod
const LINK_PITCH = 4.4;
const HEAP = 5;                     // how many humps the slack chain lies in

const lerp = (from, to, amount) => from + (to - from) * amount;

/** The rod's height for a header of this height: as tall as fits, standing on a 4px strip of turf. */
export function rodHeight(headerHeight) {
  return Math.min(44, headerHeight - 10);
}

/** Where the lead rod's top is, and how far it leans, for a pull of `progress` (0 to 1; 1 is planted). */
export function leadPose(progress, groundY, rod) {
  const amount = Math.min(1, Math.max(0, progress));
  return {
    x: lerp(LEAD_FROM, LEAD_TO, amount),
    y: lerp(-(rod + FOOT + 4), groundY - rod - FOOT, Math.pow(amount, 0.85)),
    tilt: Math.pow(1 - amount, 1.6) * 30,   // degrees: carried at an angle, swinging upright as it comes down
  };
}

/** Where a rod's chain ring is, given the rod's top position and lean (the rod turns about its top). */
export function ringPoint(x, y, tilt, rod) {
  const along = rod + FOOT - RING;
  const radians = (tilt * Math.PI) / 180;
  return { x: x - Math.sin(radians) * along, y: y + Math.cos(radians) * along };
}

/**
 * The chain from `from` to `to` as small links laid along its length, alternating face-on and edge-on like a real chain, plus the spot
 * for the clip that marks its middle. When the rods are closer than the chain is long, the extra length lies in humps along the way
 * (more slack, taller humps); when they are exactly a chain apart it is straight. `twang` (px) bows the taut chain like a plucked string.
 */
export function chainLinks(from, to, twang = 0) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const gap = Math.hypot(dx, dy);
  const extra = Math.max(0, CHAIN_LENGTH - gap);
  const amplitude = ((2 / (Math.PI * HEAP)) * Math.sqrt(gap * extra));   // humps whose extra length is the slack
  const pointAt = (along) => {
    const hump = amplitude * (1 - Math.cos(2 * Math.PI * HEAP * along)) / 2;
    return { x: lerp(from.x, to.x, along), y: lerp(from.y, to.y, along) - hump + twang * Math.sin(Math.PI * along) };
  };
  const count = Math.round(CHAIN_LENGTH / LINK_PITCH);   // a chain has the same number of links however it lies
  const links = [];
  for (let index = 0; index < count; index += 1) {
    const along = (index + 0.5) / count;
    const before = pointAt(Math.max(0, along - 0.01)), after = pointAt(Math.min(1, along + 0.01));
    links.push({ ...pointAt(along), angle: (Math.atan2(after.y - before.y, after.x - before.x) * 180) / Math.PI, edge: index % 2 === 1 });
  }
  const middle = pointAt(0.5), a = pointAt(0.49), b = pointAt(0.51);
  return { links, clip: { ...middle, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI } };
}

/** How the rubber foot looks `since` ms after it planted: it compresses and rebounds (1 is uncompressed). */
export function footSquash(since) {
  return 1 - 0.4 * Math.exp(-since / 90) * Math.cos(since / 38);
}

/** How far (px) the taut chain bows `since` ms after the foot planted: a twang that dies away, struck again every 700 ms. */
export function chainTwang(since) {
  const cycle = since % 700;
  return 5 * Math.exp(-cycle / 130) * Math.sin(cycle / 11);
}
