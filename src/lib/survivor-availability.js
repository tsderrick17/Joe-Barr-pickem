/**
 * A team this entry already used in an earlier week. The selection being made
 * and the pick saved for this week are never "used": they stay choosable until
 * the game starts (a started game is locked, not unavailable).
 * @param {{ teamId: string, usedTeamIds: string[], selectedTeamId: string | null, savedTeamId: string | null }} selection
 */
export function isSurvivorTeamUsed({ teamId, usedTeamIds, selectedTeamId, savedTeamId }) {
  return usedTeamIds.includes(teamId) && teamId !== selectedTeamId && teamId !== savedTeamId;
}

// The Slate is the only player-facing Survivor selector. Keep the visibility
// decision deterministic so an expired or historical period never presents a
// chip that the database would correctly reject.
/**
 * @param {{
 *   periodType?: string,
 *   periodStatus?: string,
 *   survivorAvailable: boolean,
 *   survivorStatus: string | null,
 *   selectedGameKickoffAt?: string | null,
 *   now?: Date,
 * }} slate
 */
export function isSurvivorSlateEditable({
  periodType,
  periodStatus,
  survivorAvailable,
  survivorStatus,
  selectedGameKickoffAt,
  now = new Date(),
}) {
  // Players are allowed to prepare the current/next regular-season slate
  // before it becomes formally active. Completed weeks must remain audit-only.
  if (periodType !== "regular" || periodStatus === "complete") return false;
  if (!survivorAvailable || survivorStatus !== "active") return false;

  if (selectedGameKickoffAt) {
    return new Date(selectedGameKickoffAt).getTime() > new Date(now).getTime();
  }

  return true;
}
