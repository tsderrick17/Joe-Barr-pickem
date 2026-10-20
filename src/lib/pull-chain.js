/**
 * The drawing math for the pull-down-to-refresh first-down chain. The scene is zoomed in on the last three yards of a ten-yard chain, as wide
 * as the page and no taller than the header: a deep strip of turf with hash marks, a football spotted at the right, and only the bottom third
 * of the lead pole showing (its top is above the header). Pulling carries the lead pole in from above at an angle; the chain, which runs in from
 * the left edge of the page (its rear end, the rear pole and the heap of slack are far off to the left), is dragged across the turf, lifts off
 * behind the lead pole and comes taut as the pole swings upright and plants its rubber foot at the ball. The ball's nose pokes out a couple of
 * inches past the pole: a first down. Kept as plain functions so the picture can be checked without a browser.
 */
export const FOOT = 6;               // the rubber stopper at the bottom of a pole, in the pole's own units
export const POLE = 44;              // the pole above the foot, in its own units (the target disc, the banner)
export const TURF = 26;              // the strip of turf along the foot of the header: the field, seen from the sideline
const RING = 3.5;                    // the chain is fastened this far above the bottom of a pole (pole units)
const ZOOM = 3;                      // how much bigger a pole is drawn than its own units: the bottom third shows in the header
const LINK_ZOOM = 2.4;               // the same for chain links
const LINK_PITCH = 4.4;              // link spacing, in link units
const FLOOR = 2.2;                   // how high a link lying on the turf sits above the ground line (link units)
const HEAP_CAP = 4.6;                // the tallest hump of slack chain lying on the turf (link units)
const BALL = { length: 44, height: 24 };   // px: about 1.8 long to 1 across, a full-bodied football
const NOSE_INCHES = 2.5;             // how far the ball's nose is past the pole's far edge: a couple of inches

const lerp = (from, to, amount) => from + (to - from) * amount;

/** Where everything stands for a page this wide: three yards across, the lead pole planted toward the right, the chain ten yards long. */
export function layout(width) {
  const yard = width / 3;
  const leadTo = Math.round(width * 0.74);
  return { width, yard, inch: yard / 36, leadTo, leadFrom: Math.round(leadTo - yard * 0.9), rear: leadTo - yard * 10, chainLength: yard * 10, zoom: ZOOM, linkZoom: LINK_ZOOM };
}

/** The whole height of a drawn pole, foot included, in px: far taller than the header, whose top it is cropped by. */
export const poleLength = (lay) => (POLE + FOOT) * lay.zoom;

/** The y of the ground line the poles' feet stand on. */
export const groundOf = (headerHeight) => headerHeight - 3;

/** Where the lead pole's top is, and how far it leans, for a pull of `progress` (0 to 1; 1 is planted). */
export function leadPose(progress, groundY, lay) {
  const amount = Math.min(1, Math.max(0, progress));
  const length = poleLength(lay);
  return {
    x: lerp(lay.leadFrom, lay.leadTo, amount),
    y: lerp(-(length + 4), groundY - length, Math.pow(amount, 0.85)),
    tilt: Math.pow(1 - amount, 1.6) * 30,   // degrees: carried at an angle, swinging upright as it comes down
  };
}

/** Where a pole's chain ring is, given the pole's top position and lean (the pole turns about its top). */
export function ringPoint(x, y, tilt, lay) {
  const along = poleLength(lay) - RING * lay.zoom;
  const radians = (tilt * Math.PI) / 180;
  return { x: x - Math.sin(radians) * along, y: y + Math.cos(radians) * along };
}

/**
 * The chain as a line of links, plus the spot for the clip at its middle. It lies on the turf, paying out from a heap far off to the left: the
 * part still on the ground lies in tight humps (more slack, more humps, never taller than a few pixels), and the rest runs straight from where
 * it leaves the turf up to the lead pole's ring. As the pole moves out the slack is used up and the lifted part grows until the chain is a
 * straight, taut line. `twang` (px) bows the taut chain like a plucked string.
 * @returns {{ links: { x: number, y: number, angle: number, edge: boolean }[], clip: { x: number, y: number, angle: number }, slack: number, taut: boolean }}
 */
export function chainLinks(from, to, { chainLength, groundY, linkZoom = LINK_ZOOM, twang = 0 }) {
  const floorY = groundY - FLOOR * linkZoom;
  const height = Math.max(0, floorY - to.y);
  const through = (leaves) => (leaves - from.x) + Math.hypot(to.x - leaves, height);   // chain used if it leaves the turf at x = leaves
  const straight = Math.hypot(to.x - from.x, to.y - from.y);
  const taut = straight >= chainLength - 1e-6;
  let leaves = from.x;
  if (!taut) {
    const wanted = Math.min(chainLength, through(to.x));
    let low = from.x, high = to.x;
    for (let step = 0; step < 40; step += 1) { const mid = (low + high) / 2; if (through(mid) < wanted) low = mid; else high = mid; }
    leaves = (low + high) / 2;
  }
  const points = [];
  const run = leaves - from.x;
  const slack = taut ? 0 : Math.max(0, chainLength - through(leaves));
  if (taut) {
    for (let i = 0; i <= 120; i += 1) { const along = i / 120; points.push({ x: lerp(from.x, to.x, along), y: lerp(from.y, to.y, along) + twang * Math.sin(Math.PI * along) }); }
  } else {
    // the part on the turf: arches resting on it, enough of them that none is taller than HEAP_CAP
    const cap = HEAP_CAP * linkZoom;
    const arches = run > 0.5 && slack > 0.05 ? Math.max(3, Math.ceil((2 / (Math.PI * cap)) * Math.sqrt(run * slack))) : 1;
    const amplitude = run > 0.5 && slack > 0.05 ? (2 / (Math.PI * arches)) * Math.sqrt(run * slack) : 0;
    const samples = Math.max(8, Math.min(1600, Math.ceil(run / 2)));
    for (let i = 0; i <= samples; i += 1) {
      const along = i / samples;
      points.push({ x: from.x + run * along, y: lerp(from.y, floorY, Math.min(1, along * 40)) - amplitude * (1 - Math.cos(2 * Math.PI * arches * along)) / 2 });
    }
    const lift = 60;
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
  const count = Math.max(2, Math.round(chainLength / (LINK_PITCH * linkZoom)));
  const links = Array.from({ length: count }, (_, index) => ({ ...at(((index + 0.5) / count) * total), edge: index % 2 === 1 }));
  return { links, clip: at(total / 2), slack, taut };
}

/**
 * The spotted football, lying on the field a little behind the sideline the poles stand on, pointing toward the defense: the lead pole stands in
 * front of its nose, and the tip pokes out a couple of inches past the pole's foot. Past the line to gain, by inches: a first down.
 */
export function ballSpot(lay, headerHeight) {
  const footHalf = 3.1 * lay.zoom;
  const nose = lay.leadTo + footHalf + NOSE_INCHES * lay.inch;
  return { x: nose - BALL.length / 2, y: headerHeight - TURF + 12.5, length: BALL.length, height: BALL.height, nose };
}

/** The yard lines (every five yards) and hash marks (every yard in between) across the page. */
export function fieldMarks(lay) {
  const offset = lay.yard * 0.35;   // the poles are not on a line
  const lines = [], hashes = [];
  for (let k = -2; k <= Math.ceil(lay.width / lay.yard) + 6; k += 1) {
    const x = lay.leadTo - offset + (k - 6) * lay.yard;
    (k % 5 === 0 ? lines : hashes).push(x);
  }
  const inView = (x) => x > -2 && x < lay.width + 2;
  return { lines: lines.filter(inView), hashes: hashes.filter(inView) };
}

/** How the rubber foot looks `since` ms after it planted (1 is uncompressed): fully squashed at contact, then easing back up. It touches down once and
 *  never bounces, so it never goes past its resting height. */
export function footSquash(since) {
  return 1 - 0.4 * Math.exp(-since / 120);
}

/** How far (px) the taut chain bows `since` ms after the foot planted: a twang that dies away, struck again every 700 ms. */
export function chainTwang(since) {
  const cycle = since % 700;
  return 14 * Math.exp(-cycle / 130) * Math.sin(cycle / 11);
}

/** How far (degrees) the planted lead pole leans away from the strain of the chain, easing upright in one smooth movement (no sway back and forth). The
 *  pole turns about its foot (see `plantedTop`), so its foot never moves while it leans. */
export function strainLean(since) {
  return 4 * Math.exp(-since / 170);
}

/** Where the top of a planted pole must be so that, leaning `tilt` degrees about its foot, the foot stays exactly at (footX, ground): the pole turns
 *  about the top in the drawing, so the top is moved to make up for it. `sink` (px) lowers the whole pole as the rubber foot compresses. */
export function plantedTop(footX, ground, tilt, length, sink = 0) {
  const radians = (tilt * Math.PI) / 180;
  return { x: footX + Math.sin(radians) * length, y: ground - Math.cos(radians) * length + sink };
}
