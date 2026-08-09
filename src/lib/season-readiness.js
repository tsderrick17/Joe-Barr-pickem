const SETTLED_GAME_STATUSES = new Set(["final", "postponed", "cancelled", "no_contest"]);

function check(id, label, detail, state = "pass") {
  return { id, label, detail, state };
}

function gameweekKey(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const number = (type) => Number(parts.find((part) => part.type === type)?.value);
  const day = new Date(Date.UTC(number("year"), number("month") - 1, number("day")));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() - 2 + 7) % 7));
  return day.toISOString().slice(0, 10);
}

/**
 * A read-only, data-shape audit for the season's operational prerequisites.
 * It intentionally does not make schedule, pick, or reminder changes.
 */
export function assessSeasonReadiness({ seasonState, periods, games, reminders, emailDeliveryFailures = 0, now = new Date() }) {
  const checks = [];
  const activePeriods = periods.filter((period) => period.status === "active");
  const completedPeriods = periods.filter((period) => period.status === "complete");

  const preseasonWaitingForKickoff = activePeriods.length === 0 && seasonState === "preseason";
  checks.push(activePeriods.length === 1
    ? check("active-period", "One active scoring period", `${activePeriods[0].display_name} is the only active period.`)
    : preseasonWaitingForKickoff
      ? check("active-period", "Scoring period activation", "Preseason is scheduled. Week 1 will activate automatically when its start time arrives.", "setup")
      : check("active-period", "One active scoring period", activePeriods.length === 0 ? "No scoring period is active." : `${activePeriods.length} scoring periods are active at once.`, "attention"));

  const incompleteCompleted = completedPeriods.filter((period) =>
    games.some((game) => game.scoring_period_id === period.id && !SETTLED_GAME_STATUSES.has(game.status)),
  );
  checks.push(incompleteCompleted.length === 0
    ? check("completed-periods", "Completed-period continuity", "Every completed period contains only settled games.")
    : check("completed-periods", "Completed-period continuity", `${incompleteCompleted.map((period) => period.display_name).join(", ")} still contains unsettled games.`, "attention"));

  const emptyCompletedPeriods = completedPeriods.filter((period) =>
    !games.some((game) => game.scoring_period_id === period.id),
  );
  checks.push(emptyCompletedPeriods.length === 0
    ? check("completed-period-data", "Completed-period data", "Every completed period retains its game history.")
    : check("completed-period-data", "Completed-period data", `${emptyCompletedPeriods.map((period) => period.display_name).join(", ")} has no retained game history.`, "attention"));

  const invalidGames = games.filter((game) =>
    !game.kickoff_at || !game.line_lock_at || !game.away_team_id || !game.home_team_id ||
    game.away_team_id === game.home_team_id || new Date(game.line_lock_at) > new Date(game.kickoff_at),
  );
  checks.push(invalidGames.length === 0
    ? check("game-timing", "Game timing and matchups", "Every game has a valid matchup and an official line lock no later than kickoff.")
    : check("game-timing", "Game timing and matchups", `${invalidGames.length} game${invalidGames.length === 1 ? " has" : "s have"} invalid timing or matchup data.`, "attention"));

  const periodById = new Map(periods.map((period) => [period.id, period]));
  const pinnedGames = games.filter((game) => game.gameweek_key !== undefined);
  const gameweekMismatches = pinnedGames.filter((game) => {
    const period = periodById.get(game.scoring_period_id);
    return !game.gameweek_key || !period ||
      (period.starts_at && game.gameweek_key !== gameweekKey(period.starts_at));
  });
  checks.push(gameweekMismatches.length === 0
    ? check("gameweek-pins", "Permanent gameweek assignments", "Every game is pinned to the scoring period where it was originally scheduled.")
    : check("gameweek-pins", "Permanent gameweek assignments", `${gameweekMismatches.length} game${gameweekMismatches.length === 1 ? " is" : "s are"} pinned to the wrong scoring period.`, "attention"));

  const playoffPeriods = periods.filter((period) => period.period_type === "playoff");
  const scheduledPlayoffPeriods = playoffPeriods.filter((period) => games.some((game) => game.scoring_period_id === period.id));
  const capacityProblems = scheduledPlayoffPeriods.filter((period) => {
    const playableGames = games.filter((game) =>
      game.scoring_period_id === period.id && !["postponed", "cancelled", "no_contest"].includes(game.status),
    ).length;
    return playableGames !== period.max_picks;
  });

  if (playoffPeriods.length === 0) {
    checks.push(check("playoff-capacity", "Playoff round capacity", "Playoff scoring periods have not been loaded yet. Add them before the postseason.", "setup"));
  } else if (scheduledPlayoffPeriods.length === 0) {
    checks.push(check("playoff-capacity", "Playoff round capacity", "Playoff rounds exist; their game schedule can be imported when the bracket is known.", "setup"));
  } else if (capacityProblems.length === 0) {
    checks.push(check("playoff-capacity", "Playoff round capacity", "Each scheduled playoff round requires one ATS selection for every playable game."));
  } else {
    checks.push(check("playoff-capacity", "Playoff round capacity", `${capacityProblems.map((period) => period.display_name).join(", ")} has a max-pick count that does not match its playable games.`, "attention"));
  }

  const staleSending = reminders.filter((reminder) => reminder.status === "sending" && reminder.processing_started_at && now.getTime() - new Date(reminder.processing_started_at).getTime() > 20 * 60 * 1000);
  const failedReminders = reminders.filter((reminder) => reminder.status === "failed");
  if (failedReminders.length || staleSending.length || emailDeliveryFailures) {
    const issues = [
      failedReminders.length ? `${failedReminders.length} failed reminder${failedReminders.length === 1 ? "" : "s"}` : null,
      staleSending.length ? `${staleSending.length} stale reminder${staleSending.length === 1 ? "" : "s"}` : null,
      emailDeliveryFailures ? `${emailDeliveryFailures} failed email deliver${emailDeliveryFailures === 1 ? "y" : "ies"}` : null,
    ].filter(Boolean).join(", ");
    checks.push(check("reminder-queue", "Reminder delivery queue", `${issues} need attention.`, "attention"));
  } else {
    checks.push(check("reminder-queue", "Reminder delivery queue", "No reminder is failed or stalled in delivery."));
  }

  const state = checks.some((item) => item.state === "attention")
    ? "attention"
    : checks.some((item) => item.state === "setup")
      ? "setup"
      : "ready";
  return { status: state, checks };
}
