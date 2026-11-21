// Makes every bowl logo the Bowl ticket's pennants fly (public/bowl-logos/<name>.webp) from its full-size original
// (assets/bowl-logos/<name>.svg|png|webp|jpg, as downloaded from the bowl's Wikipedia article, or for LA, whose Wikipedia copy is
// tiny, SoFi Stadium's game-day poster), at one standard size, the way every NFL
// team's logo reads the same size on the Survivor board: each logo is trimmed to its own edges, then scaled so it covers the same area
// as every other (a tall shield and a wide wordmark look equally big), never past the pennant's logo box, and centred on a clear canvas
// the shape of that box (288 x 138, three times the 96 x 46 the pennant draws it at, so it stays sharp on a phone). Always made from the
// original, never from an earlier output, so re-running it loses nothing. Safe to re-run; a new bowl's original is fitted the same way.
//   node scripts/fit-bowl-logos.mjs [name ...]      (no names: every logo)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SOURCE = new URL("../assets/bowl-logos/", import.meta.url);
const OUT = new URL("../public/bowl-logos/", import.meta.url);
const BOX = { width: 288, height: 138 };
const AREA = 19350;   // the area every logo covers on that canvas: about a 139 x 139 square
const RENDER = 1600;  // a drawn (svg) logo is rendered with its longer side this many pixels before it is fitted

/**
 * What a few originals need before fitting:
 *   crop     - only this part of the original is the logo (a poster).
 *   cutBox   - the logo sits on a solid white box: the white joined to the image's edge is cleared.
 *   cutDark  - the logo sits on this dark colour (a poster's navy): it is cleared, and the logo's soft edges un-blended from it.
 *   clear    - boxes (in the cropped picture): every shape lying wholly inside one is wiped out, a shape reaching outside is kept whole
 *              (LA's "Bucked Up" deer and wordmark go; the swoosh under them stays).
 *   smoothTop - between these two columns the top edge is redrawn as one smooth curve joining its ends, filling any notch below it
 *              (LA's swoosh was notched to make room for the "Bucked Up" wordmark).
 *   recolor  - colours swapped in the drawing (the playoff's black lettering would vanish on a dark pennant).
 *   dropLast - the lowest piece (below a clear gap) is cut off, or the lowest N pieces: Las Vegas's "XXXV" anniversary tag, the Rose Bowl's sponsor line.
 */
const PREP = {
  cfp: { recolor: [["#130c0e", "#ffffff"]] },
  la: { crop: { left: 800, top: 70, width: 920, height: 420 }, cutDark: [21, 36, 75], clear: [{ left: 0, top: 0, width: 195, height: 200 }, { left: 190, top: 60, width: 460, height: 80 }], smoothTop: [480, 645] },
  rate: { cutBox: true },
  "las-vegas": { dropLast: true },
  rose: { dropLast: 2 },
};

const names = process.argv.slice(2);
const sources = readdirSync(SOURCE).filter((file) => /\.(svg|png|webp|jpg)$/.test(file));
const chosen = names.length ? sources.filter((file) => names.includes(file.replace(/\.\w+$/, ""))) : sources;

for (const file of chosen) {
  const name = file.replace(/\.\w+$/, "");
  const prep = PREP[name] ?? {};
  let input = readFileSync(fileURLToPath(new URL(file, SOURCE)));
  let options = {};
  if (file.endsWith(".svg")) {
    let svg = input.toString("utf8");
    for (const [from, to] of prep.recolor ?? []) svg = svg.split(from).join(to);
    input = Buffer.from(svg);
    const { width, height } = await sharp(input, { density: 72 }).metadata();
    options = { density: Math.min(2400, (72 * RENDER) / Math.max(width, height)) };
  }
  let image = sharp(input, options);
  if (prep.crop) image = sharp(await image.extract(prep.crop).png().toBuffer());
  const raw = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (prep.cutDark) cutDark(raw, prep.cutDark);
  if (prep.cutBox) cutBox(raw);
  if (prep.clear) clearShapes(raw, prep.clear);
  if (prep.smoothTop) smoothTop(raw, prep.smoothTop);
  for (let piece = 0; piece < Number(prep.dropLast ?? 0); piece++) dropLast(raw);
  const trimmed = await sharp(raw.data, { raw: raw.info }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;
  const ratio = width / height;
  let fitWidth = Math.sqrt(AREA * ratio);
  let fitHeight = fitWidth / ratio;
  const shrink = Math.min(1, BOX.width / fitWidth, BOX.height / fitHeight);
  fitWidth = Math.round(fitWidth * shrink);
  fitHeight = Math.round(fitHeight * shrink);
  const logo = await sharp(trimmed.data).resize(fitWidth, fitHeight, { kernel: "lanczos3" }).png().toBuffer();
  const output = await sharp({ create: { ...BOX, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: Math.round((BOX.width - fitWidth) / 2), top: Math.round((BOX.height - fitHeight) / 2) }])
    .webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toBuffer();
  if (!existsSync(OUT)) throw new Error("public/bowl-logos/ is missing");
  writeFileSync(fileURLToPath(new URL(`${name}.webp`, OUT)), output);
  console.log(`${name}: ${width} x ${height} -> ${fitWidth} x ${fitHeight}`);
}

/** Clears the near-white joined to the image's edge (a solid box behind the logo), softly at the logo's anti-aliased rim. */
function cutBox({ data, info }) {
  const { width, height } = info;
  const whiteness = (i) => Math.max(255 - data[i], 255 - data[i + 1], 255 - data[i + 2]);
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    const off = whiteness(i);
    if (off > 70) continue;
    data[i + 3] = Math.min(data[i + 3], off < 22 ? 0 : Math.round(((off - 22) / 48) * 255));
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < width * (height - 1)) stack.push(p + width);
  }
}

/** Clears the poster's dark ground (and anything near its colour, such as faint palms printed on it), keeping the bright logo. */
function cutDark({ data }, ground) {
  for (let i = 0; i < data.length; i += 4) {
    const off = Math.hypot(data[i] - ground[0], data[i + 1] - ground[1], data[i + 2] - ground[2]);
    const soft = Math.max(0, Math.min(1, (off - 40) / 90));
    const alpha = soft < 0.08 ? 0 : soft; // a faint speck (a palm frond printed on the poster) is ground too
    data[i + 3] = Math.round(alpha * 255);
    if (alpha > 0 && alpha < 1) for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - alpha) * ground[c]) / alpha)));
  }
}

/** Clears every shape (pixels joined to each other) that lies wholly inside one of the boxes. */
function clearShapes({ data, info }, boxes) {
  const { width, height } = info;
  const seen = new Uint8Array(width * height);
  const inside = (x, y) => boxes.some((b) => x >= b.left && x < b.left + b.width && y >= b.top && y < b.top + b.height);
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || data[start * 4 + 3] === 0) continue;
    const shape = [];
    const stack = [start];
    seen[start] = 1;
    let contained = true;
    while (stack.length) {
      const p = stack.pop();
      shape.push(p);
      const x = p % width;
      const y = (p - x) / width;
      if (contained && !inside(x, y)) contained = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (!seen[q] && data[q * 4 + 3] > 0) { seen[q] = 1; stack.push(q); }
      }
    }
    if (contained) for (const p of shape) data[p * 4 + 3] = 0;
  }
}

/** Redraws the top edge between two columns as a smooth curve (matching the edge's height and slope at both ends), filling below it. */
function smoothTop({ data, info }, [from, to]) {
  const { width, height } = info;
  const top = (x) => { for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] > 128) return y; return height; };
  const y0 = top(from);
  const y1 = top(to);
  const s0 = (top(from) - top(from - 12)) / 12;
  const s1 = (top(to + 12) - top(to)) / 12;
  const span = to - from;
  for (let x = from; x <= to; x++) {
    const t = (x - from) / span;
    const edge = (2 * t ** 3 - 3 * t ** 2 + 1) * y0 + (t ** 3 - 2 * t ** 2 + t) * span * s0 + (-2 * t ** 3 + 3 * t ** 2) * y1 + (t ** 3 - t ** 2) * span * s1;
    const now = top(x);
    for (let y = Math.floor(edge); y < now; y++) {
      const i = (y * width + x) * 4;
      const cover = y === Math.floor(edge) ? 1 - (edge - y) : 1;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.max(data[i + 3], Math.round(cover * 255));
    }
  }
}

/** Clears everything below the last clear band of rows that has drawing above it (the bottom tag). */
function dropLast({ data, info }) {
  const { width, height } = info;
  const rowFilled = (y) => { for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 24) return true; return false; };
  let y = height - 1;
  while (y > 0 && !rowFilled(y)) y--;          // past the empty margin
  while (y > 0 && rowFilled(y)) y--;           // up through the tag
  if (y <= 0) return;
  for (let row = y; row < height; row++) for (let x = 0; x < width; x++) data[(row * width + x) * 4 + 3] = 0;
}
