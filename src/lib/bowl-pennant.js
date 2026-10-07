/**
 * Pennant colors for a Bowl Pool team. The colors are the school's own, saved
 * from ESPN's team record by the schedule import; a missing or malformed value
 * falls back to the pool's navy and gold, never to a guess.
 */
export const BOWL_NAVY = "#16223a";
export const BOWL_GOLD = "#b38b4d";

/** ESPN sends six hex digits with no "#". Return "#rrggbb" in lower case, or null. */
/** @param {unknown} value @returns {string | null} */
export function normalizeHexColor(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toLowerCase()}` : null;
}

/** @param {string} hex */
function luminance(hex) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Whichever of white or near-black reads better on the given color. */
/** @param {string} background */
export function readableInk(background) {
  return luminance(background) > 0.4 ? "#1d1d1f" : "#ffffff";
}

/**
 * @param {{ primary_color?: string | null, secondary_color?: string | null } | null | undefined} team
 * @returns {{ primary: string, secondary: string, ink: string }}
 */
export function bowlPennantColors(team) {
  const primary = normalizeHexColor(team?.primary_color) ?? BOWL_NAVY;
  const secondary = normalizeHexColor(team?.secondary_color) ?? BOWL_GOLD;
  return { primary, secondary, ink: readableInk(primary) };
}

/** Bowls span the turn of the year: the 2026 season is labeled "2026-27". */
/** @param {number} seasonYear */
export function bowlSeasonLabel(seasonYear) {
  return `${seasonYear}-${String((seasonYear + 1) % 100).padStart(2, "0")}`;
}
