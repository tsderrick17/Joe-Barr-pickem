function samePick(left, right) {
  return left?.gameId === right?.gameId && left?.teamId === right?.teamId;
}

/**
 * Reconcile the browser's ATS draft when time advances across one or more
 * kickoffs. Submitted picks become the authority for kicked games; unsaved
 * choices for later games remain intact.
 */
export function reconcileAtsDraftAtKickoff({ games, selections, savedPicks, now }) {
  const nowTime = now.getTime();
  const selectedByGame = new Map(selections.map((pick) => [pick.gameId, pick]));
  const savedByGame = new Map(savedPicks.map((pick) => [pick.gameId, pick]));

  const reconciled = games.flatMap((game) => {
    const isKicked = new Date(game.kickoffAt).getTime() <= nowTime;
    const pick = isKicked ? savedByGame.get(game.id) : selectedByGame.get(game.id);
    return pick ? [pick] : [];
  });

  const changed = reconciled.length !== selections.length ||
    reconciled.some((pick, index) => !samePick(pick, selections[index]));

  return { selections: reconciled, changed };
}

/**
 * Survivor remains one weekly choice rather than one choice per game. Once
 * either the submitted game or an unsaved replacement reaches kickoff, the
 * submitted receipt wins and the browser draft is restored to it.
 */
export function reconcileSurvivorDraftAtKickoff({ games, selection, savedPick, now }) {
  if (samePick(selection, savedPick)) {
    return { selection, changed: false };
  }

  const savedGame = savedPick
    ? games.find((game) => game.id === savedPick.gameId)
    : null;
  const selectedGame = selection
    ? games.find((game) => game.id === selection.gameId)
    : null;
  const nowTime = now.getTime();
  const savedGameKicked = Boolean(savedGame && new Date(savedGame.kickoffAt).getTime() <= nowTime);
  const selectedGameKicked = Boolean(selectedGame && new Date(selectedGame.kickoffAt).getTime() <= nowTime);

  return savedGameKicked || selectedGameKicked
    ? { selection: savedPick ?? null, changed: true }
    : { selection, changed: false };
}
