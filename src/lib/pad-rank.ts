/**
 * Pick'em ranks by total wins: 1 plus the number of players with more wins, and a "T" in front when someone else has the
 * same total ("T3"). Rank the whole pool, then show only some of the rows, so a row's rank never depends on who is shown.
 */
export function padRankLabels(players: Array<{ id: string; wins: number }>) {
  const labels = new Map<string, string>();
  for (const player of players) {
    const rank = 1 + players.filter((other) => other.wins > player.wins).length;
    const tied = players.some((other) => other.id !== player.id && other.wins === player.wins);
    labels.set(player.id, `${tied ? "T" : ""}${rank}`);
  }
  return labels;
}
