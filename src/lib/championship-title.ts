/** A trophy's hover title: the season as it is played ('25-26, since the NFL season runs into the next year), the pool, and Champion or Co-Champion. */
export function championshipTitle(seasonYear: number, poolLabel: string, coChampion: boolean) {
  const nextYear = String((seasonYear + 1) % 100).padStart(2, "0");
  return `'${String(seasonYear % 100).padStart(2, "0")}-${nextYear} ${poolLabel} ${coChampion ? "Co-Champion" : "Champion"}`;
}
