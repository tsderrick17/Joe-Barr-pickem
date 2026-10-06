/** The 2026 launch displayed the known prior holder before the first recorded champion. */
export function survivorChampionDisplayId({
  seasonYear,
  recordedChampionId,
  activePlayers,
}: {
  seasonYear: number;
  recordedChampionId: string | null;
  activePlayers: Array<{ id: string; first_name: string }>;
}): string | null {
  if (recordedChampionId) return recordedChampionId;
  if (seasonYear !== 2026) return null;
  return activePlayers.find((player) => player.first_name.trim().toLocaleLowerCase() === "john")?.id ?? null;
}
