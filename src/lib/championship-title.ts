/**
 * A trophy's hover title: the season, the pool, and Champion or Co-Champion. Pick'em and the Bowl Pool run into the next calendar
 * year ('25-26); Survivor is decided within the one year, so it reads just '25.
 */
export function championshipTitle(seasonYear: number, poolLabel: string, coChampion: boolean) {
  const year = String(seasonYear % 100).padStart(2, "0");
  const season = poolLabel === "Survivor" ? year : `${year}-${String((seasonYear + 1) % 100).padStart(2, "0")}`;
  return `'${season} ${poolLabel} ${coChampion ? "Co-Champion" : "Champion"}`;
}
