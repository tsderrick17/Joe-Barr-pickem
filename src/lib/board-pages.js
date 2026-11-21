/**
 * The room's Big Board pages: the leaders (always on the top line), and the rest of the standings split into even pages of at most
 * `size` players. A single leader is not repeated in the pages; level leaders are, since the top line then shows only how many lead.
 * @template {{ name: string, place: number | null, wins: number }} Row
 * @param {Row[]} rows the leaderboard, leader first
 * @param {number} [size]
 * @returns {{ leaders: Row[], pages: Row[][] }}
 */
export function boardPages(rows, size = 4) {
  const leaders = rows.filter((row) => row.place === 1);
  const rest = leaders.length === 1 ? rows.slice(1) : rows;
  const count = Math.max(1, Math.ceil(rest.length / size));
  // As even as they go: the first pages take one more when the players do not split exactly (ten is 4, 3, 3).
  const cut = (index) => index * Math.floor(rest.length / count) + Math.min(index, rest.length % count);
  return { leaders, pages: Array.from({ length: count }, (_, index) => rest.slice(cut(index), cut(index + 1))) };
}
