/**
 * The players who hold a pool's trophy right now: the champion, or co-champions, of the latest season that has one.
 * A new season's champion takes the trophy from the last one; earlier titles remain in the player's trophy list.
 */
export function reigningChampionIds(championships: Array<{ player_id: string; pool: string; season_year: number }>, pool: string) {
  const rows = championships.filter((row) => row.pool === pool);
  const latest = Math.max(0, ...rows.map((row) => row.season_year));
  return new Set(rows.filter((row) => row.season_year === latest).map((row) => row.player_id));
}
