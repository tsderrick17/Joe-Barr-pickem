export function assessSeasonIntegrity({ periods, games, picks, survivorPicks, lineGameIds }) {
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const gameById = new Map(games.map((game) => [game.id, game]));
  const pickCounts = new Map();
  const survivorTeams = new Set();
  let pickLimitViolations = 0;
  let invalidAtsPicks = 0;
  let ungradedFinalAtsPicks = 0;
  let duplicateSurvivorTeams = 0;
  let invalidSurvivorPicks = 0;
  let ungradedFinalSurvivorPicks = 0;

  for (const pick of picks) {
    const key = `${pick.player_id}:${pick.scoring_period_id}`;
    pickCounts.set(key, (pickCounts.get(key) ?? 0) + 1);
    const period = periodById.get(pick.scoring_period_id);
    const game = gameById.get(pick.game_id);
    if (!period || !game || game.scoring_period_id !== pick.scoring_period_id || ![game.away_team_id, game.home_team_id].includes(pick.selected_team_id)) invalidAtsPicks += 1;
    if (game?.status === "final" && lineGameIds.has(game.id) && pick.result === "pending") ungradedFinalAtsPicks += 1;
  }

  for (const [key, count] of pickCounts) {
    const [, periodId] = key.split(":");
    const period = periodById.get(periodId);
    if (period && count > period.max_picks) pickLimitViolations += 1;
  }

  for (const pick of survivorPicks) {
    const game = gameById.get(pick.game_id);
    const key = `${pick.survivor_entry_id}:${pick.selected_team_id}`;
    if (survivorTeams.has(key)) duplicateSurvivorTeams += 1;
    survivorTeams.add(key);
    if (!game || game.scoring_period_id !== pick.scoring_period_id || ![game.away_team_id, game.home_team_id].includes(pick.selected_team_id)) invalidSurvivorPicks += 1;
    if (game?.status === "final" && pick.result === "pending") ungradedFinalSurvivorPicks += 1;
  }

  const incompleteCompletedPeriods = periods.filter((period) => period.status === "complete" && games.some((game) => game.scoring_period_id === period.id && !["final", "postponed", "cancelled"].includes(game.status))).length;
  const finalGamesMissingLines = games.filter((game) => game.status === "final" && !lineGameIds.has(game.id)).length;

  const checks = [
    { id: "ats-limit", label: "ATS pick limits", detail: pickLimitViolations ? `${pickLimitViolations} player-week limit violation${pickLimitViolations === 1 ? "" : "s"}.` : "No player exceeds their period pick limit.", failed: pickLimitViolations },
    { id: "ats-validity", label: "ATS game and team validity", detail: invalidAtsPicks ? `${invalidAtsPicks} ATS pick${invalidAtsPicks === 1 ? "" : "s"} does not match its game or week.` : "Every ATS pick matches its game, team, and scoring period.", failed: invalidAtsPicks },
    { id: "ats-finals", label: "Final ATS grading", detail: ungradedFinalAtsPicks ? `${ungradedFinalAtsPicks} final ATS pick${ungradedFinalAtsPicks === 1 ? " remains" : "s remain"} ungraded.` : "All final ATS picks with official lines are graded.", failed: ungradedFinalAtsPicks },
    { id: "survivor-reuse", label: "Survivor team reuse", detail: duplicateSurvivorTeams ? `${duplicateSurvivorTeams} repeated Survivor team selection${duplicateSurvivorTeams === 1 ? "" : "s"}.` : "No Survivor entry has reused a team.", failed: duplicateSurvivorTeams },
    { id: "survivor-validity", label: "Survivor game and team validity", detail: invalidSurvivorPicks ? `${invalidSurvivorPicks} Survivor pick${invalidSurvivorPicks === 1 ? "" : "s"} does not match its game or week.` : "Every Survivor pick matches its game, team, and scoring period.", failed: invalidSurvivorPicks },
    { id: "survivor-finals", label: "Final Survivor grading", detail: ungradedFinalSurvivorPicks ? `${ungradedFinalSurvivorPicks} final Survivor pick${ungradedFinalSurvivorPicks === 1 ? " remains" : "s remain"} ungraded.` : "All final Survivor picks are graded.", failed: ungradedFinalSurvivorPicks },
    { id: "period-completion", label: "Completed-week continuity", detail: incompleteCompletedPeriods ? `${incompleteCompletedPeriods} completed scoring period${incompleteCompletedPeriods === 1 ? " still has" : "s still have"} unsettled games.` : "Completed scoring periods contain only settled games.", failed: incompleteCompletedPeriods },
    { id: "final-lines", label: "Final game line receipts", detail: finalGamesMissingLines ? `${finalGamesMissingLines} final game${finalGamesMissingLines === 1 ? " is" : "s are"} missing an official line receipt.` : "Every final game has an official line receipt.", failed: finalGamesMissingLines },
  ];

  return { status: checks.some((check) => check.failed) ? "attention" : "healthy", checks };
}
