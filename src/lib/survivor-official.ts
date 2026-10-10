type Entry = { id: string; status: string; eliminated_scoring_period_id: string | null };
type Pick = { survivor_entry_id: string; scoring_period_id: string; result: string | null };

/**
 * The eliminated entries that are officially out. A player who loses is not out until another entry makes a correct
 * pick in the same week: if everyone left loses together, they share the title (see "Survivor co-champions"), so until
 * someone else wins that week a lost entry still counts as in. An elimination with no recorded week is out.
 */
export function officiallyOutEntryIds(entries: Entry[], picks: Pick[]) {
  const winnersByPeriod = new Map<string, Set<string>>();
  for (const pick of picks) {
    if (pick.result !== "win") continue;
    const winners = winnersByPeriod.get(pick.scoring_period_id) ?? new Set<string>();
    winners.add(pick.survivor_entry_id);
    winnersByPeriod.set(pick.scoring_period_id, winners);
  }
  const out = new Set<string>();
  for (const entry of entries) {
    if (entry.status !== "eliminated") continue;
    const winners = entry.eliminated_scoring_period_id ? winnersByPeriod.get(entry.eliminated_scoring_period_id) : undefined;
    const someoneElseWon = winners ? [...winners].some((id) => id !== entry.id) : false;
    if (!entry.eliminated_scoring_period_id || someoneElseWon) out.add(entry.id);
  }
  return out;
}
