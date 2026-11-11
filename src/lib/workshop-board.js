// The Workshop: every custom piece of the pool once, packed into one living board.
// Plain data and arithmetic, no React, so the board's maps and saved settings can be checked on their own.

/** Settings the Commissioner tried, remembered on this device only. */
export const WORKSHOP_SAVED_KEY = "pickem-workshop";

/**
 * The board: every piece once, packed into one grid with no gaps, each in a tile shaped for it. A layout is drawn as rows of cells, each cell
 * naming the piece that covers it, so the map reads like the board itself. A piece covers one filled rectangle; every cell is covered. Three
 * maps: a phone (2 columns), a tablet (4) and a computer (6). The tiles are in the computer's reading order on the page.
 */
const C = "crest", F = "football", S = "submit", H = "highlight", K = "chip", P = "pull", M = "pennant", T = "tile", W = "wins", X = "stamp";
const A = "banner-pickem", B = "banner-bowl", V = "banner-survivor", E = "eliminated", O = "season-over";
export const WORKSHOP_LAYOUTS = {
  phone: [
    [C, C], [S, S], [F, H], [F, K], [P, P], [T, W], [M, X],
    [A, B], [A, B], [V, V], [V, V], [E, E], [O, O],
  ],
  tablet: [
    [C, C, C, C], [F, F, S, S], [F, F, H, H], [P, P, P, P], [K, K, T, W],
    [A, A, B, B], [A, A, B, B], [V, V, M, M], [V, V, X, X], [E, E, E, E], [O, O, O, O],
  ],
  desktop: [
    [C, C, C, C, F, F], [S, S, H, K, F, F], [P, P, P, P, M, M],
    [A, A, B, B, V, V], [A, A, B, B, V, V], [E, E, E, E, E, E], [O, O, O, X, T, W],
  ],
};

/** Where each piece sits in one layout: its first row and column (from 1) and how many it spans. */
export function layoutPlaces(rows) {
  const places = {};
  rows.forEach((row, r) => row.forEach((id, c) => {
    const place = places[id];
    if (!place) places[id] = { row: r + 1, column: c + 1, rows: 1, columns: 1 };
    else {
      place.rows = Math.max(place.rows, r + 2 - place.row);
      place.columns = Math.max(place.columns, c + 2 - place.column);
    }
  }));
  return places;
}

/** The CSS grid-area of a place: row start / column start / row end / column end. */
export const gridArea = ({ row, column, rows, columns }) => `${row} / ${column} / ${row + rows} / ${column + columns}`;

/** The order of the pieces on the page: the computer's map read row by row. */
export const WORKSHOP_ORDER = [...new Set(WORKSHOP_LAYOUTS.desktop.flat())];

/**
 * Problems with a layout against the list of pieces: a row of the wrong width, a piece missing, one that does not exist, or one whose
 * cells are not a single filled rectangle. Empty means every piece is on the board once and the board has no gaps.
 */
export function layoutProblems(rows, pieceIds) {
  const problems = [];
  const width = rows[0]?.length ?? 0;
  rows.forEach((row, r) => { if (row.length !== width) problems.push(`row ${r + 1} is ${row.length} wide, not ${width}`); });
  const placed = new Set(rows.flat());
  for (const id of pieceIds) if (!placed.has(id)) problems.push(`${id} is not on the board`);
  for (const id of placed) if (!pieceIds.includes(id)) problems.push(`${id} is not a piece`);
  for (const [id, place] of Object.entries(layoutPlaces(rows))) {
    for (let r = place.row; r < place.row + place.rows; r++) {
      for (let c = place.column; c < place.column + place.columns; c++) {
        if (rows[r - 1]?.[c - 1] !== id) { problems.push(`${id} is not one rectangle`); r = Infinity; break; }
      }
    }
    const cells = rows.flat().filter((cell) => cell === id).length;
    if (cells !== place.rows * place.columns && !problems.includes(`${id} is not one rectangle`)) problems.push(`${id} is not one rectangle`);
  }
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
