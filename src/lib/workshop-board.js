// The Workshop showroom: every custom piece of the pool once, on shelves grouped by where it lives, in an ordinary scrolling page.
// Plain data and arithmetic, no React, so the shelves and saved settings can be checked on their own.

/** Settings the Commissioner tried, remembered on this device only. */
export const WORKSHOP_SAVED_KEY = "pickem-workshop";

/**
 * The shelves, top to bottom. Each piece has a width in columns (1, 2, or "full" for the wide ones) and a height in rows, so the shelf
 * reads as a tidy grid at every width: two columns on a phone, more on a computer, wide pieces always across the whole shelf.
 */
export const WORKSHOP_SHELVES = [
  { title: "Pick’em", pieces: [{ id: "submit", span: 2 }, { id: "highlight", span: 2 }, { id: "chip", span: 1, rows: 2 }, { id: "stamp", span: 1 }] },
  { title: "Bowl Pool", pieces: [{ id: "crest", span: "full" }, { id: "pennant", span: 1, rows: 2 }, { id: "tile", span: 1 }, { id: "wins", span: 1 }] },
  { title: "Around the site", pieces: [{ id: "football", span: 2, rows: 2 }, { id: "pull", span: "full" }, { id: "season-over", span: "full" }, { id: "eliminated", span: "full" }] },
  { title: "Trophy banners", pieces: [{ id: "banner-pickem", span: 1, rows: 2 }, { id: "banner-bowl", span: 1, rows: 2 }, { id: "banner-survivor", span: 1, rows: 2 }] },
];

/** Problems with the shelves against the list of pieces: one missing, one shown twice, or one that does not exist. Empty means every piece is on a shelf once. */
export function shelfProblems(shelves, pieceIds) {
  const placed = shelves.flatMap((shelf) => shelf.pieces.map((piece) => piece.id));
  const problems = [];
  for (const id of pieceIds) if (!placed.includes(id)) problems.push(`${id} is on no shelf`);
  for (const id of new Set(placed)) if (placed.filter((other) => other === id).length > 1) problems.push(`${id} is on more than one shelf`);
  for (const id of placed) if (!pieceIds.includes(id)) problems.push(`${id} is not a piece`);
  return problems;
}

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
