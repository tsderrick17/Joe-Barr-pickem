/** The pool's first Survivor champion, crowned the season before the app tracked champions. */
export const INAUGURAL_SURVIVOR_YEAR = 2025;
/** The one season (the launch season) that shows the inaugural champion before its own champion is crowned. */
export const LAUNCH_SEASON_YEAR = 2026;

type ChampionshipRecord = { player_id: string; pool: string; season_year: number };

/**
 * Who the Standings name as the Survivor champion. A season's own recorded champion always wins. Until it has one,
 * only the launch season shows the inaugural (2025) champion, taken from the recorded championship history rather
 * than from a name, and only while that player is still active. Every later season shows no champion until one is
 * crowned.
 */
export function survivorChampionDisplayId({
  seasonYear,
  recordedChampionId,
  championships,
  activePlayers,
}: {
  seasonYear: number;
  recordedChampionId: string | null;
  championships: ChampionshipRecord[];
  activePlayers: Array<{ id: string }>;
}): string | null {
  if (recordedChampionId) return recordedChampionId;
  if (seasonYear !== LAUNCH_SEASON_YEAR) return null;
  const active = new Set(activePlayers.map((player) => player.id));
  return championships.find((row) => row.pool === "survivor" && row.season_year === INAUGURAL_SURVIVOR_YEAR && active.has(row.player_id))?.player_id ?? null;
}
