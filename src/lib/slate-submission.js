export function prepareAtsReplacements({ selections, existingPicks, games, now = new Date() }) {
  const gameById = new Map(games.map((game) => [game.id, game]));
  const lockedExisting = existingPicks.filter((pick) => {
    const game = gameById.get(pick.game_id);
    return game && now >= new Date(game.kickoff_at);
  });

  for (const selection of selections) {
    const game = gameById.get(selection.gameId);
    if (!game) return { error: "One of your selected games could not be found." };
    if (selection.teamId !== game.away_team_id && selection.teamId !== game.home_team_id) {
      return { error: "One of your selected teams does not belong to that game." };
    }

    const matchingLockedPick = lockedExisting.some(
      (pick) => pick.game_id === selection.gameId && pick.selected_team_id === selection.teamId,
    );
    if (now >= new Date(game.kickoff_at) && !matchingLockedPick) {
      return { error: "One of your selected games has already started." };
    }
  }

  // A browser may submit only the newly editable portion of a ticket after a
  // prior game has kicked off. The database RPC preserves locked picks, so do
  // not require those sealed rows to be echoed back when another selection is
  // being added. An empty submission remains an explicit clear attempt and
  // is still rejected while any locked pick exists.
  if (selections.length === 0 && lockedExisting.length > 0) {
    return { error: "One of your existing picks has already started and cannot be changed or removed." };
  }

  return {
    replacements: selections
      .filter((selection) => !lockedExisting.some(
        (pick) => pick.game_id === selection.gameId && pick.selected_team_id === selection.teamId,
      ))
      .map((selection) => ({ game_id: selection.gameId, selected_team_id: selection.teamId })),
  };
}

/**
 * Pick'em and Survivor use one receipt, but they remain independently
 * editable. Omit Survivor entirely unless it changed so a sealed Survivor
 * selection can never block a valid later ATS submission.
 */
export function buildSlateSubmission({
  scoringPeriodId,
  selections,
  survivorAvailable,
  survivorHasUnsavedChanges,
  survivorPick,
}) {
  return {
    scoringPeriodId,
    selections,
    ...(survivorAvailable && survivorHasUnsavedChanges
      ? { survivorSelection: survivorPick }
      : {}),
  };
}
