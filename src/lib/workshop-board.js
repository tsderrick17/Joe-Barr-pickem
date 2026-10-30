// The Workshop board: one patch of tiles, repeated forever in every direction, looked at through a camera that pans and zooms.
// Plain arithmetic, no React, so the layout and the camera can be checked on their own.

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.5;
export const TILE_GAP = 6;
/** Settings the Commissioner tried, remembered on this device only. */
export const WORKSHOP_SAVED_KEY = "pickem-workshop";

/**
 * One patch of the board, on a grid of 6 columns by 7 rows; it repeats in every direction, every other row shifted half a patch.
 *   crest crest crest submit submit stamp
 *   ball  ball  pen   pen    mega   chip
 *   ball  ball  games wins   mega   chip
 *   over  over  over  out    out    out
 *   pull  pull  pull  pull   pull   pull
 *   red   red   blue  blue   green  green
 *   red   red   blue  blue   green  green
 */
export const WORKSHOP_PATCH = {
  cols: 6,
  rows: 7,
  tiles: [
    { id: "crest", col: 0, row: 0, cols: 3, rows: 1 },
    { id: "submit", col: 3, row: 0, cols: 2, rows: 1 },
    { id: "stamp", col: 5, row: 0, cols: 1, rows: 1 },
    { id: "football", col: 0, row: 1, cols: 2, rows: 2 },
    { id: "highlight", col: 2, row: 1, cols: 2, rows: 1 },
    { id: "pennant", col: 4, row: 1, cols: 1, rows: 2 },
    { id: "chip", col: 5, row: 1, cols: 1, rows: 2 },
    { id: "tile", col: 2, row: 2, cols: 1, rows: 1 },
    { id: "wins", col: 3, row: 2, cols: 1, rows: 1 },
    { id: "season-over", col: 0, row: 3, cols: 3, rows: 1 },
    { id: "eliminated", col: 3, row: 3, cols: 3, rows: 1 },
    { id: "pull", col: 0, row: 4, cols: 6, rows: 1 },
    { id: "banner-pickem", col: 0, row: 5, cols: 2, rows: 2 },
    { id: "banner-bowl", col: 2, row: 5, cols: 2, rows: 2 },
    { id: "banner-survivor", col: 4, row: 5, cols: 2, rows: 2 },
  ],
};

/** The size of one grid cell: smaller on a phone, so more of the board is in view. */
export const cellSize = (viewportWidth) => (viewportWidth < 640 ? 150 : 180);

/** Problems with a patch layout: a tile outside the patch, two tiles on one cell, or a cell left empty. An empty list means it tiles cleanly. */
export function patchProblems(tiles, cols, rows) {
  const problems = [];
  const owner = new Map();
  for (const tile of tiles) {
    if (tile.col < 0 || tile.row < 0 || tile.col + tile.cols > cols || tile.row + tile.rows > rows) problems.push(`${tile.id} runs outside the patch`);
    for (let c = tile.col; c < tile.col + tile.cols; c += 1) {
      for (let r = tile.row; r < tile.row + tile.rows; r += 1) {
        const cell = `${c},${r}`;
        if (owner.has(cell)) problems.push(`${tile.id} overlaps ${owner.get(cell)} at ${cell}`);
        else owner.set(cell, tile.id);
      }
    }
  }
  for (let c = 0; c < cols; c += 1) for (let r = 0; r < rows; r += 1) if (!owner.has(`${c},${r}`)) problems.push(`cell ${c},${r} is empty`);
  return problems;
}

/** One patch's size on the board, including the gap after its last column and row so repeats sit as evenly as the tiles inside. */
export const patchSize = (cols, rows, cell, gap = TILE_GAP) => ({ width: cols * (cell + gap), height: rows * (cell + gap) });

/** Where a tile sits inside its patch. */
export const tileBox = (tile, cell, gap = TILE_GAP) => ({
  left: tile.col * (cell + gap),
  top: tile.row * (cell + gap),
  width: tile.cols * (cell + gap) - gap,
  height: tile.rows * (cell + gap) - gap,
});

/** Every other row of patches is shifted half a patch sideways, like brickwork, so the repeat is harder to spot. */
const rowShift = (j, width) => (((j % 2) + 2) % 2 === 1 ? width / 2 : 0);

/**
 * The copies of the patch that the screen shows, each with its top-left corner on the board. The camera puts board point (0, 0) at screen
 * point (x, y) and scales by zoom; margin (in board pixels) also includes copies just outside the screen, so a short drag never shows a gap.
 */
export function visibleCopies(camera, viewport, patch, margin = 0) {
  const left = -camera.x / camera.zoom - margin;
  const top = -camera.y / camera.zoom - margin;
  const right = (viewport.width - camera.x) / camera.zoom + margin;
  const bottom = (viewport.height - camera.y) / camera.zoom + margin;
  const copies = [];
  for (let j = Math.floor(top / patch.height); j * patch.height < bottom; j += 1) {
    const shift = rowShift(j, patch.width);
    for (let i = Math.floor((left - shift) / patch.width); i * patch.width + shift < right; i += 1) {
      copies.push({ key: `${i}:${j}`, left: i * patch.width + shift, top: j * patch.height });
    }
  }
  return copies;
}

export const clampZoom = (zoom) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

/** Zoom by a factor about a screen point, keeping the board point under it still (a pinch or a wheel zooms where it happens). */
export function zoomAt(camera, factor, point) {
  const zoom = clampZoom(camera.zoom * factor);
  const scale = zoom / camera.zoom;
  return { x: point.x - (point.x - camera.x) * scale, y: point.y - (point.y - camera.y) * scale, zoom };
}

/** After a fling the board glides on and slows: the speed left after dt milliseconds. */
export const glide = (speed, dt) => speed * Math.pow(0.94, dt / 16);

/**
 * Saved settings laid over the defaults, keeping only what still fits: a value is taken when it has the same type as the default (objects
 * one level at a time), a number must be finite and inside its limits, and a word must be one of its choices. Anything else falls back to the
 * default, so an old or damaged save can never break the page.
 */
export function mergeSaved(defaults, saved, { limits = {}, choices = {} } = {}, path = "") {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaults;
  const merged = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const name = path ? `${path}.${key}` : key;
    const value = saved[key];
    if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) merged[key] = mergeSaved(fallback, value, { limits, choices }, name);
    else if (typeof value !== typeof fallback) merged[key] = fallback;
    else if (typeof value === "number") {
      const limit = limits[name] ?? limits[key];
      merged[key] = Number.isFinite(value) && (!limit || (value >= limit[0] && value <= limit[1])) ? value : fallback;
    } else if (typeof value === "string") {
      const allowed = choices[name];
      merged[key] = !allowed || allowed.includes(value) ? value : fallback;
    } else merged[key] = value;
  }
  return merged;
}
