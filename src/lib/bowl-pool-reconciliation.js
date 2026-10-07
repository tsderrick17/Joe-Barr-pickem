/** @typedef {"scheduled" | "live" | "final" | "postponed" | "cancelled" | "no_contest"} BowlSettlementGameStatus */
/** @typedef {{ id: string, status: BowlSettlementGameStatus }} BowlSettlementGame */
/** @typedef {{ id: string, status: "active" | "withdrawn" | "complete" }} BowlSettlementEntry */
/** @typedef {{ entry_id: string, game_id: string, result: "pending" | "win" | "loss" | "void" }} BowlSettlementPick */
/** @typedef {{ entry_id: string, game_id: string, result: "win" | "loss" | "void" }} BowlSettlementReceipt */
/** @typedef {{ game_id: string }} BowlSettlementLine */
/** @typedef {{ healthy: boolean, problems: string[] }} BowlSettlementAssessment */

/**
 * @param {{
 *   games: BowlSettlementGame[],
 *   entries: BowlSettlementEntry[],
 *   picks: BowlSettlementPick[],
 *   results: BowlSettlementReceipt[],
 *   lines: BowlSettlementLine[],
 * }} input
 * @returns {BowlSettlementAssessment}
 */
export function assessBowlPoolSettlement({ games, entries, picks, results, lines }) {
  const problems = [];
  const lineIds = new Set(lines.map((line) => line.game_id));
  /** @param {{ entry_id: string, game_id: string }} row */
  const key = (row) => `${row.entry_id}:${row.game_id}`;
  const resultKeys = new Set();
  for (const result of results) {
    const resultKey = key(result);
    if (resultKeys.has(resultKey)) problems.push(`Duplicate Bowl Pool result receipt for ${resultKey}.`);
    resultKeys.add(resultKey);
  }
  const pickByKey = new Map(picks.map((pick) => [key(pick), pick]));
  for (const game of games) if (game.status === "final" && !lineIds.has(game.id)) problems.push(`Final Bowl Pool game ${game.id} has no locked line.`);
  for (const entry of entries.filter((row) => row.status === "active")) {
    for (const game of games) {
      if (!["live", "final"].includes(game.status)) continue;
      const resultKey = `${entry.id}:${game.id}`;
      const result = results.find((row) => key(row) === resultKey);
      const pick = pickByKey.get(resultKey);
      if (!result) problems.push(`Active Bowl Pool entry ${entry.id} is missing a result for game ${game.id}.`);
      if (game.status === "final" && pick?.result === "pending") problems.push(`Final Bowl Pool pick ${resultKey} is still pending.`);
      if (pick && result && pick.result !== result.result) problems.push(`Bowl Pool pick/result mismatch for ${resultKey}.`);
    }
  }
  return { healthy: problems.length === 0, problems };
}
