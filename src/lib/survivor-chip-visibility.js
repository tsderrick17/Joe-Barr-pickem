/**
 * Survivor chips are a selection surface for a live Survivor pool only.
 * Awarding the Survivor trophy retires the surface immediately; the next
 * season starts with a fresh season record and can expose it again.
 */
export function shouldShowSurvivorSlateChips({
  periodType,
  championCrownedAt,
}) {
  if (periodType !== "regular") return false;
  return !championCrownedAt;
}
