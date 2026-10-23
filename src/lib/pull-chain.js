/**
 * The drawing math for the pull-down-to-refresh first-down chain and its down counter. The scene is zoomed in on the last three yards of a
 * ten-yard chain, as wide as the page and no taller than the header: a deep strip of turf with hash marks, a football spotted at the right, a down
 * counter standing off in the distance, and only the bottom third of the lead pole showing (its top is above the header).
 *
 * Pulling has two stages. In the first (`PUFF_AT` of the pull) the lead pole comes down foot first with the chain always taut: the chain runs
 * straight from its fixed end at the left edge of the page, rising about 15 degrees above the ground at the start, so the pole's ring hangs in the
 * air before and above the ball. As the pole lowers the chain angle falls to nothing and its reach grows (reach is the chain's length times the
 * cosine of its angle), so the ring arrives at the ball only when the foot lands; at the same time the pole, leaning with its foot leading,
 * straightens up. The foot lands upright with a puff of dust (the measurement), then swings once a little past upright and settles. In the
 * second stage the down counter slides from 4 to 1, following the finger; when it has fully turned to 1 the pull is complete (refresh armed).
 * Kept as plain functions so the picture can be checked without a browser.
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
  return { width, yard, inch: yard / 36, leadTo, anchorX: -8, zoom: ZOOM, linkZoom: LINK_ZOOM };
}

/** The whole height of a drawn pole, foot included, in px: far taller than the header, whose top it is cropped by. */
export const poleLength = (lay) => (POLE + FOOT) * lay.zoom;

/** The y of the ground line the poles' feet stand on. */
export const groundOf = (headerHeight) => headerHeight - 3;

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

// ---------------------------------------------------------------------------------------------------------------------------------
// The pull: the pole's descent, the landing, and the counter.

/** How far through the pull (0 to 1) the foot lands and the dust puffs; the counter turns over the rest. */
export const PUFF_AT = 0.5;
const CHAIN_START_DEGREES = 15;      // the chain's angle above the ground when the pole first comes into view
const LEAN_START_DEGREES = 22;       // how far the pole leans, its foot leading, as it first comes in
const OVERSHOOT_DEGREES = 3;         // how far past upright it swings once when it lands
const OVERSHOOT_MS = 130;            // and how soon it has swung farthest

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => value * value * (3 - 2 * value);

/** The two stages of a pull of `progress` (0 to 1): how far the pole has come down (0 to 1, landed at 1), and how far the counter has turned (0 to 1). */
export function pullStages(progress) {
  const pull = clamp01(progress);
  return { descent: clamp01(pull / PUFF_AT), counter: clamp01((pull - PUFF_AT) / (1 - PUFF_AT)) };
}

/** The fixed end of the chain: at the left edge of the page, at the height of a pole's ring when it stands on the ground. */
export const chainAnchor = (lay, groundY) => ({ x: lay.anchorX, y: groundY - RING * lay.zoom });

/** The chain's length: exactly the reach to the ring of a pole standing at the ball, so the chain is straight when the pole has landed. */
export const chainReach = (lay) => lay.leadTo - lay.anchorX;

/**
 * The pole while it is coming down (`descent` 0 to 1). The chain is straight and taut the whole way, turning about its fixed end: it rises
 * `CHAIN_START_DEGREES` at the start and lies flat at the ring's own height when the foot lands, its reach growing as the cosine of its angle.
 * The pole leans with its foot leading and straightens as it lowers. Returns the ring (where the chain is fastened), the pole's top (which the
 * drawing turns about) and its foot, and `lean` (degrees, the foot ahead of the top when positive).
 */
export function descentPose(descent, lay, groundY) {
  const anchor = chainAnchor(lay, groundY), reach = chainReach(lay);
  const angle = (CHAIN_START_DEGREES * (1 - descent) * Math.PI) / 180;
  const ring = { x: anchor.x + reach * Math.cos(angle), y: anchor.y - reach * Math.sin(angle) };
  const lean = LEAN_START_DEGREES * (1 - smooth(descent));
  return poseFromRing(ring, lean, lay);
}

/** The pole once its foot has landed: the foot stays exactly where it touched down, and the pole swings about it (`lean` in degrees). `sink` (px) lowers
 *  the whole pole as the rubber foot compresses. */
export function plantedPose(lean, lay, groundY, sink = 0) {
  const radians = (lean * Math.PI) / 180, direction = { x: Math.sin(radians), y: Math.cos(radians) };   // from the top toward the foot
  const foot = { x: lay.leadTo, y: groundY + sink };
  const ring = { x: foot.x - RING * lay.zoom * direction.x, y: foot.y - RING * lay.zoom * direction.y };
  return poseFromRing(ring, lean, lay);
}

function poseFromRing(ring, lean, lay) {
  const radians = (lean * Math.PI) / 180, direction = { x: Math.sin(radians), y: Math.cos(radians) };
  const along = poleLength(lay) - RING * lay.zoom;
  return {
    lean,
    ring,
    top: { x: ring.x - along * direction.x, y: ring.y - along * direction.y },
    foot: { x: ring.x + RING * lay.zoom * direction.x, y: ring.y + RING * lay.zoom * direction.y },
  };
}

/** How far past upright the pole is (degrees, negative: its top ahead of its foot) `since` ms after the foot landed: it swings out once, a little, and
 *  settles back, never again past upright (a single rise and fall, no ringing). */
export function landingLean(since) {
  const k = Math.max(0, since) / OVERSHOOT_MS;
  return -OVERSHOOT_DEGREES * k * Math.exp(1 - k) + 0;   // (+ 0 keeps the instant of landing a plain zero)
}

/** How far each slat of the down counter has slid (0 to 1) when the counter has turned `progress` of the way: every other slat leads, the ones
 *  between follow once it is done, so halfway there the panel reads 1, 4, 1, 4 down its height. */
export function slatOffsets(progress, slats) {
  const turned = clamp01(progress);
  return Array.from({ length: slats }, (_, index) => (index % 2 === 1 ? smooth(clamp01(turned / 0.5)) : smooth(clamp01((turned - 0.5) / 0.5))));
}

/** The down counter is 168 units tall: a 104-unit marker on a long 64-unit pole. */
export const COUNTER_TALL = 168;

/** Where the down counter stands: well to the right of the ball, small for being far away, with its pole planted just off the field, on the sideline. */
export function counterSpot(lay, headerHeight) {
  const ground = headerHeight - TURF;
  const scale = Math.min(0.36, (ground - 3) / COUNTER_TALL);
  return { x: lay.leadTo + lay.yard * 0.42, ground, scale };
}
