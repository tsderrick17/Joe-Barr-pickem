/**
 * The champions of one pool, newest first, one entry per season that has any, with co-champions joined into one line
 * ("Gary & Rick"). Seasons: { seasonYear, pickem, survivor, bowl } where each pool is null or [{ name }].
 */
export function championRoll(seasons, pool) {
  return [...seasons]
    .sort((a, b) => b.seasonYear - a.seasonYear)
    .filter((season) => season[pool]?.length)
    .map((season) => ({ year: season.seasonYear, names: season[pool].map((champion) => champion.name).join(" & ") }));
}
