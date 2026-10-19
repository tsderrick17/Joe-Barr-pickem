/**
 * The drawing math for the pull-down-to-refresh first-down chain. The scene is as wide as the page: a strip of turf along the foot of the
 * header with yard lines and hash marks, the rear rod planted at the left, and a football spotted at the right, which is what is being
 * measured. Pulling carries the lead rod in from above the top edge at an angle; the chain pays out of a heap on the ground by the rear rod,
 * lifts off the turf behind the lead rod, and comes taut as the rod swings upright and plants its rubber foot beside the ball. The ball's
 * nose is a couple of inches past the rod: a first down. Kept as plain functions so the picture can be checked without a browser.
 */
export const FOOT = 6;               // the rubber stopper at the bottom of a rod
export const TURF = 14;              // the strip of turf along the foot of the header: the field, with the sideline where the rods stand at its near edge
const RING = 3.5;                    // the chain is fastened this far above the bottom of a rod
const LINK_PITCH = 4.4;
const FLOOR = 2.2;                   // how high a link lying on the turf sits above the ground line
const HEAP_CAP = 4.6;                // the tallest hump of slack chain lying on the turf
const BALL = { length: 15, height: 7.5 };
const NOSE_PAST = 2.5;               // how far the ball's nose is past the rod's near edge (a couple of inches at this scale): a first down

const lerp = (from, to, amount) => from + (to - from) * amount;

/** Where everything stands for a page this wide: the rods are a chain's length (ten yards) apart once the lead rod has planted. */
export function layout(width) {
  const rear = Math.round(width * 0.1), leadTo = Math.round(width * 0.9);
  return { width, rear, leadFrom: Math.round(rear + (leadTo - rear) * 0.23), leadTo, chainLength: leadTo - rear, yard: (leadTo - rear) / 10 };
}

/** The rod's height for a header of this height: as tall as fits above the turf. */
export function rodHeight(headerHeight) {
  return Math.min(44, headerHeight - TURF - 6);
}

/** The y of the ground line the rods' feet stand on. */
export const groundOf = (headerHeight) => headerHeight - 3;

/** Where the lead rod's top is, and how far it leans, for a pull of `progress` (0 to 1; 1 is planted). */
export function leadPose(progress, groundY, rod, lay) {
  const amount = Math.min(1, Math.max(0, progress));
  return {
    x: lerp(lay.leadFrom, lay.leadTo, amount),
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
 * The chain as a line of links, plus the spot for the clip at its middle. It pays out of a heap lying on the turf by the rear rod: the
 * part still on the ground lies in tight humps (more slack, more humps, never taller than a few pixels), and the rest runs straight from
 * where it leaves the turf up to the lead rod's ring. As the rod moves out the heap shrinks and the lifted part grows until the chain is a
 * straight, taut line. `twang` (px) bows the taut chain like a plucked string.
 * @returns {{ links: { x: number, y: number, angle: number, edge: boolean }[], clip: { x: number, y: number, angle: number }, slack: number, taut: boolean }}
 */
export function chainLinks(from, to, { chainLength, groundY, twang = 0 }) {
  const floorY = groundY - FLOOR;
  const height = Math.max(0, floorY - to.y);
  const through = (leaves) => (leaves - from.x) + Math.hypot(to.x - leaves, height);   // chain used if it leaves the turf at x = leaves
  const straight = Math.hypot(to.x - from.x, to.y - from.y);
  const taut = straight >= chainLength - 1e-6;
  let leaves = from.x;
  if (!taut) {
    const most = through(to.x);
    const wanted = Math.min(chainLength, most);
    let low = from.x, high = to.x;
    for (let step = 0; step < 40; step += 1) { const mid = (low + high) / 2; if (through(mid) < wanted) low = mid; else high = mid; }
    leaves = (low + high) / 2;
  }
  const points = [];
  const run = leaves - from.x;
  const slack = taut ? 0 : Math.max(0, chainLength - through(leaves));
  if (taut) {
    for (let i = 0; i <= 60; i += 1) { const along = i / 60; points.push({ x: lerp(from.x, to.x, along), y: lerp(from.y, to.y, along) + twang * Math.sin(Math.PI * along) }); }
  } else {
    // the heap: arches resting on the turf, enough of them that none is taller than HEAP_CAP
    const arches = run > 0.5 && slack > 0.05 ? Math.max(3, Math.ceil((2 / (Math.PI * HEAP_CAP)) * Math.sqrt(run * slack))) : 1;
    const amplitude = run > 0.5 && slack > 0.05 ? (2 / (Math.PI * arches)) * Math.sqrt(run * slack) : 0;
    const samples = Math.max(8, Math.ceil(run / 1.2));
    for (let i = 0; i <= samples; i += 1) {
      const along = i / samples;
      points.push({ x: from.x + run * along, y: lerp(from.y, floorY, Math.min(1, along * 6)) - amplitude * (1 - Math.cos(2 * Math.PI * arches * along)) / 2 });
    }
    const lift = 40;
    for (let i = 1; i <= lift; i += 1) { const along = i / lift; points.push({ x: lerp(leaves, to.x, along), y: lerp(floorY, to.y, along) }); }
  }
  // links at equal steps along the whole length, so a heap is dense and a stretched run is even
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = lengths[lengths.length - 1];
  const at = (distance) => {
    let index = 1;
    while (index < points.length - 1 && lengths[index] < distance) index += 1;
    const span = lengths[index] - lengths[index - 1] || 1, t = (distance - lengths[index - 1]) / span;
    const a = points[index - 1], b = points[index];
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
  };
  const count = Math.max(2, Math.round(chainLength / LINK_PITCH));
  const links = Array.from({ length: count }, (_, index) => ({ ...at(((index + 0.5) / count) * total), edge: index % 2 === 1 }));
  return { links, clip: at(total / 2), slack, taut };
}

/**
 * The spotted football, lying on the field a little behind the sideline the rods stand on, pointing at the lead rod: its nose is a couple of
 * inches past the rod's near (rear) edge, which is what makes it a first down.
 */
export function ballSpot(lay, headerHeight) {
  const footHalf = 3.1;
  const nose = lay.leadTo - footHalf + NOSE_PAST;
  return { x: nose - BALL.length / 2, y: headerHeight - TURF + 4.6, length: BALL.length, height: BALL.height, nose };
}

/** The yard lines (every five yards, full height of the turf) and hash marks (every yard, short ticks top and bottom) across the page. */
export function fieldMarks(lay) {
  const offset = lay.yard * 0.35;   // the rear rod is not on a line
  const lines = [], hashes = [];
  for (let k = -1; k <= Math.ceil(lay.width / (lay.yard * 5)) + 1; k += 1) lines.push(lay.rear - offset + k * lay.yard * 5);
  for (let k = -5; k <= Math.ceil(lay.width / lay.yard) + 5; k += 1) {
    const x = lay.rear - offset + k * lay.yard;
    if (k % 5 !== 0) hashes.push(x);
  }
  return { lines: lines.filter((x) => x > -1 && x < lay.width + 1), hashes: hashes.filter((x) => x > -1 && x < lay.width + 1) };
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

/** How far (degrees) the planted lead rod leans away from the strain of the chain, settling upright. */
export function strainLean(since) {
  return 5 * Math.exp(-since / 170) * Math.cos(since / 60);
}
