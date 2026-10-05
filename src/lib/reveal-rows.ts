// The rows of a pick-reveal email image (Sunday windows, featured games), built from rows
// already read. Nothing here touches the database. A pick can appear only if it belongs to
// the current period, to a game in the revealed set the caller chose (games that have
// kicked off), and, where given, to a player in the allowed set.

export type LockedGameLine = { game_id: string; favorite_team_id: string | null; locked_spread: number | string | null };

export function publicPickLabel({
  gameId,
  selectedTeamId,
  abbreviationById,
  lineByGame,
}: {
  gameId: string;
  selectedTeamId: string;
  abbreviationById: Map<string, string>;
  lineByGame: Map<string, LockedGameLine>;
}) {
  const team = abbreviationById.get(selectedTeamId) ?? "NFL";
  const line = lineByGame.get(gameId);
  const spread = Number(line?.locked_spread);
  if (!line || !Number.isFinite(spread)) return `${team} · —`;
  if (spread === 0) return `${team} PK`;
  const signedSpread = line.favorite_team_id === selectedTeamId ? -Math.abs(spread) : Math.abs(spread);
  return `${team} ${signedSpread > 0 ? "+" : "−"}${Math.abs(signedSpread)}`;
}

export function onlyRowsWithPublicPicks<Row extends { picks: string[] }>(rows: Row[]) {
  return rows.filter((row) => row.picks.length > 0);
}

/** Labels of each player's picks on the revealed games, in the order the picks were read. */
export function revealPickLabels({
  picks,
  periodId,
  revealedGameIds,
  allowedPlayerIds,
  abbreviationById,
  lineByGame,
}: {
  picks: Array<{ player_id: string; game_id: string; selected_team_id: string; scoring_period_id: string }>;
  periodId: string;
  revealedGameIds: Set<string>;
  allowedPlayerIds?: Set<string>;
  abbreviationById: Map<string, string>;
  lineByGame: Map<string, LockedGameLine>;
}) {
  const picksByPlayer = new Map<string, string[]>();
  for (const pick of picks) {
    if (pick.scoring_period_id !== periodId || !revealedGameIds.has(pick.game_id)) continue;
    if (allowedPlayerIds && !allowedPlayerIds.has(pick.player_id)) continue;
    picksByPlayer.set(pick.player_id, [...(picksByPlayer.get(pick.player_id) ?? []), publicPickLabel({ gameId: pick.game_id, selectedTeamId: pick.selected_team_id, abbreviationById, lineByGame })]);
  }
  return picksByPlayer;
}
