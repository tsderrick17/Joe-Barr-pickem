// Eighteen weeks, 272 games, and one bye per team: two full weeks followed by
// sixteen weeks with a different pair of teams on bye.
export function regularSeasonTeamPairs(weekIndex) {
  if (!Number.isInteger(weekIndex) || weekIndex < 0 || weekIndex >= 18) {
    throw new RangeError("Regular-season week must be between 0 and 17.");
  }

  const byePair = weekIndex < 2 ? -1 : weekIndex - 2;
  const playing = Array.from({ length: 32 }, (_, index) => index)
    .filter((index) => Math.floor(index / 2) !== byePair);
  const rotation = weekIndex % playing.length;

  return Array.from({ length: playing.length / 2 }, (_, gameIndex) => [
    playing[(rotation + gameIndex * 2) % playing.length],
    playing[(rotation + gameIndex * 2 + 1) % playing.length],
  ]);
}
