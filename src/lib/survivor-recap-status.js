/**
 * How a player's Survivor entry reads in the weekly recap. A crowned champion is never "OUT", whatever their entry says (a champion made no
 * picks after the competition ended; the entry is not the source of truth for who won).
 * @param {{ entryStatus: string | undefined, isChampion: boolean }} input
 * @returns {"IN" | "OUT"}
 */
export function recapSurvivorStatus({ entryStatus, isChampion }) {
  return entryStatus === "eliminated" && !isChampion ? "OUT" : "IN";
}

/**
 * Whether the champion was crowned during the recap's week: the crowning moment falls from that week's first kickoff to a day after its last.
 * (It used to be guessed from "somebody was eliminated that week", which a later no-pick elimination of the champion himself also satisfied.)
 * @param {{ crownedAt: string | null | undefined, firstKickoffAt: string | null | undefined, lastKickoffAt: string | null | undefined }} input
 */
export function crownedInRecapWeek({ crownedAt, firstKickoffAt, lastKickoffAt }) {
  const crowned = Date.parse(crownedAt ?? ""), first = Date.parse(firstKickoffAt ?? ""), last = Date.parse(lastKickoffAt ?? "");
  if (![crowned, first, last].every(Number.isFinite)) return false;
  return crowned >= first && crowned <= last + 24 * 3_600_000;
}
