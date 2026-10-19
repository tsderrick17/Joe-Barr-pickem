/**
 * The banners for one pool: one per person who has won it, never one per year. A banner carries every year its person has won
 * (oldest first), so a repeat winner adds a year to the banner they already have, and a new winner gets a new banner, hung after the
 * ones before it. Banners are in the order they were first earned; co-champions of one season are ordered by name.
 * Seasons: { seasonYear, pickem, survivor, bowl } where each pool is null or [{ playerId, name }].
 * @param {Array<Record<string, any>>} seasons
 * @param {string} pool
 * @returns {Array<{ playerId: string, name: string, years: number[] }>}
 */
export function championRoll(seasons, pool) {
  const banners = new Map();
  for (const season of [...seasons].sort((a, b) => a.seasonYear - b.seasonYear)) {
    for (const champion of [...(season[pool] ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
      const key = champion.playerId ?? champion.name;
      const banner = banners.get(key) ?? { playerId: key, name: champion.name, years: [] };
      banner.name = champion.name;
      if (!banner.years.includes(season.seasonYear)) banner.years.push(season.seasonYear);
      banners.set(key, banner);
    }
  }
  return [...banners.values()];
}
