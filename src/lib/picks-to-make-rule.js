// @ts-check

/**
 * How many picks a player still has to make this week, the number on the app icon. Pure, so every rule can be tested without a database.
 * Pick'em counts the picks the week allows minus the ones made (never more than the games still open and unpicked); Survivor counts one while the
 * player is still in it and has not picked. Once nothing is open to pick, the answer is zero.
 * @param {{ maxPicks: number, openGameIds: string[], pickedGameIds: string[], survivorApplicable: boolean, survivorActive: boolean, survivorPicked: boolean }} week
 */
export function picksStillToMake({ maxPicks, openGameIds, pickedGameIds, survivorApplicable, survivorActive, survivorPicked }) {
  if (openGameIds.length === 0) return 0;
  const picked = new Set(pickedGameIds);
  const openAndUnpicked = openGameIds.filter((id) => !picked.has(id)).length;
  const pickem = Math.min(Math.max(0, maxPicks - picked.size), openAndUnpicked);
  const survivor = survivorApplicable && survivorActive && !survivorPicked ? 1 : 0;
  return pickem + survivor;
}
