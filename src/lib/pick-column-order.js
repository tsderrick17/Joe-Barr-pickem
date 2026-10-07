// @ts-check
/**
 * Which column a pick sits in, everywhere a player's picks are laid out side by
 * side (the Pick'em Pad, the ticket): earliest kickoff first, and the game's own
 * id to break a tie. Both are public facts about the game, so the order never
 * depends on when a pick was submitted or edited, on whether it has been
 * revealed yet, or on whether it won. A pick keeps its column.
 * @param {{ kickoffAt?: string | null, gameId?: string | null }} first
 * @param {{ kickoffAt?: string | null, gameId?: string | null }} second
 * @returns {number}
 */
export function comparePickColumns(first, second) {
  const firstParsedKickoff = first.kickoffAt ? Date.parse(first.kickoffAt) : Number.NaN;
  const secondParsedKickoff = second.kickoffAt ? Date.parse(second.kickoffAt) : Number.NaN;
  const firstKickoff = Number.isFinite(firstParsedKickoff) ? firstParsedKickoff : Number.MAX_SAFE_INTEGER;
  const secondKickoff = Number.isFinite(secondParsedKickoff) ? secondParsedKickoff : Number.MAX_SAFE_INTEGER;
  if (firstKickoff !== secondKickoff) return firstKickoff - secondKickoff;
  return String(first.gameId ?? "").localeCompare(String(second.gameId ?? ""));
}
