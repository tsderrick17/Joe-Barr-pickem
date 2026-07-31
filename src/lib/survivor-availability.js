export function isSurvivorTeamUnavailable({
  teamId,
  usedTeamIds,
  savedPickTeamId,
  gameStarted,
  entryEliminated,
}) {
  if (entryEliminated || gameStarted) return true;

  // The pick saved for this same week is included in the season-long used
  // list, but stays editable until its game begins.
  return usedTeamIds.includes(teamId) && teamId !== savedPickTeamId;
}

// The Slate is the only player-facing Survivor selector. Keep the visibility
// decision deterministic so an expired or historical period never presents a
// chip that the database would correctly reject.
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
