// Display abbreviations used on the handwritten scorepads. This is cosmetic
// only; database team abbreviations remain the canonical logo/data keys.
const ALWAYS_UPPERCASE = new Set(["GB", "KC", "LAC", "LAR", "LV", "NE", "NYG", "NYJ", "SF", "TB"]);

export function scorepadAbbreviation(abbreviation: string | null | undefined, fallback = "NFL") {
  const value = (abbreviation ?? fallback).trim().toUpperCase();
  if (ALWAYS_UPPERCASE.has(value)) return value;
  return value.length === 3 ? `${value[0]}${value.slice(1).toLowerCase()}` : value;
}
