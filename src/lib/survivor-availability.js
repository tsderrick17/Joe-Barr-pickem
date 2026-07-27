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
