/**
 * Which column a pick sits in, everywhere a player's picks are laid out side by
 * side (the Pick'em Pad, the ticket): earliest kickoff first, and the game's own
 * id to break a tie. Both are public facts about the game, so the order never
 * depends on when a pick was submitted or edited, on whether it has been
 * revealed yet, or on whether it won. A pick keeps its column.
 */
export function comparePickColumns(first, second) {
  const firstKickoff = first.kickoffAt ? new Date(first.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
  const secondKickoff = second.kickoffAt ? new Date(second.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (firstKickoff !== secondKickoff) return firstKickoff - secondKickoff;
  return String(first.gameId ?? "").localeCompare(String(second.gameId ?? ""));
}
