// Update these names after each season's final standings are rubber-stamped.
export const LAST_SEASON_PICKEM_CHAMPION = "Steve";
export const LAST_SEASON_SURVIVOR_CHAMPION = "John";

export function isLastSeasonChampion(
  pool: "pickem" | "survivor",
  firstName: string,
) {
  const champion = pool === "pickem"
    ? LAST_SEASON_PICKEM_CHAMPION
    : LAST_SEASON_SURVIVOR_CHAMPION;

  return firstName.trim().toLocaleLowerCase() === champion.toLocaleLowerCase();
}
