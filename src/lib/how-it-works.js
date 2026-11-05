/**
 * How the "How it works" instructions on the Slate and the Bowl Pool start out.
 *
 *  - null: the classic instructions, always open, with no fold (every player but the Commissioner, until the fold opens to all);
 *  - "open": a player new to this kind of week (no saved picks yet) sees everything, with a "How it works" button to fold it away;
 *  - "folded": a familiar player sees the short rules, and "How it works" opens the rest.
 *
 * Familiar comes from the player's own saved picks, so it is the same on every phone and computer. On the Slate it means a pick in an
 * earlier week of the same kind this season, so week 1 of a season and the first playoff round (when the rules change to every
 * playoff game) start open again.
 *
 * @param {{ preview: boolean; familiar: boolean }} input
 * @returns {"open" | "folded" | null}
 */
export function howItWorksStart({ preview, familiar }) {
  if (!preview) return null;
  return familiar ? "folded" : "open";
}
