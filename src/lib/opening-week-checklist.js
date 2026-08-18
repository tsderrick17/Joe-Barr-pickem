function item(id, label, detail, state = "ready") {
  return { id, label, detail, state };
}

/**
 * A deliberately read-only opening-week checklist. It only reports whether
 * the pieces needed for a clean launch are present; it never opens a period,
 * imports games, sends email, or changes a pick.
 * @param {{periods: Array<{id: string, display_name?: string, display_order?: number, period_type: string}>, games: Array<{scoring_period_id: string, kickoff_at?: string, line_lock_at?: string, away_team_id?: string, home_team_id?: string, status: string}>, activePlayerCount: number, automationChecks?: Array<{passed: boolean, label: string}>, readinessChecks?: Array<{id: string, state: string, detail?: string}>}} input
 */
export function assessOpeningWeekChecklist({ periods, games, activePlayerCount, automationChecks = [], readinessChecks = [] }) {
  const checks = [];
  const weekOne = periods.find((period) => period.period_type === "regular" && period.display_order === 1)
    ?? periods.find((period) => period.period_type === "regular" && /^week 1$/i.test(period.display_name ?? ""));
  const weekOneGames = weekOne ? games.filter((game) => game.scoring_period_id === weekOne.id) : [];
  const playableGames = weekOneGames.filter((game) => !["cancelled", "postponed"].includes(game.status));

  checks.push(!weekOne
    ? item("week-one", "Week 1 is on the board", "Add a Week 1 scoring period before opening the pool.", "attention")
    : playableGames.length === 0
      ? item("week-one", "Week 1 is on the board", "Week 1 exists, but it has no playable games yet.", "attention")
      : item("week-one", "Week 1 is on the board", `${weekOne.display_name} has ${playableGames.length} playable game${playableGames.length === 1 ? "" : "s"}.`));

  const invalidTiming = playableGames.filter((game) => !game.kickoff_at || !game.line_lock_at || !game.away_team_id || !game.home_team_id || game.away_team_id === game.home_team_id || new Date(game.line_lock_at) > new Date(game.kickoff_at));
  const earlyLocks = playableGames.filter((game) => {
    if (!game.kickoff_at || !game.line_lock_at) return false;
    const kickoff = new Date(game.kickoff_at);
    const lock = new Date(game.line_lock_at);
    return lock.toDateString() !== kickoff.toDateString() || lock.getTime() < kickoff.getTime() - 60 * 60 * 1000;
  });
  checks.push(!weekOne
    ? item("timing", "Kickoff and line locks agree", "This will be checked once Week 1 games are loaded.", "setup")
    : invalidTiming.length
      ? item("timing", "Kickoff and line locks agree", `${invalidTiming.length} Week 1 game${invalidTiming.length === 1 ? " needs" : "s need"} a valid matchup, kickoff, or official line-lock time.`, "attention")
      : item("timing", "Kickoff and line locks agree", earlyLocks.length ? `${playableGames.length} game${playableGames.length === 1 ? " is" : "s are"} valid, including ${earlyLocks.length} early or special lock${earlyLocks.length === 1 ? "" : "s"}.` : `${playableGames.length} game${playableGames.length === 1 ? " is" : "s are"} valid and each line lock is no later than kickoff.`));

  checks.push(activePlayerCount >= 2
    ? item("roster", "Player access is loaded", `${activePlayerCount} active players can sign in and Week 1 accepts its configured number of picks.`)
    : item("roster", "Player access is loaded", activePlayerCount === 1 ? "Only one active player is on the roster." : "No active players are on the roster.", "attention"));

  const failedAutomation = automationChecks.filter((check) => !check.passed);
  checks.push(automationChecks.length === 0
    ? item("automation", "Automation is armed", "Run Automation Preflight once its Supabase schedules are available.", "setup")
    : failedAutomation.length
      ? item("automation", "Automation is armed", failedAutomation.map((check) => check.label).join(", ") + " needs attention.", "attention")
      : item("automation", "Automation is armed", "Critical schedules, cron authorization, Odds API, Brevo sender, and Commissioner alerts are ready."));

  const reminderReadiness = readinessChecks.find((check) => check.id === "reminder-queue");
  checks.push(!reminderReadiness
    ? item("delivery", "Reminder delivery has a clean runway", "Run Season Readiness after reminders are configured.", "setup")
    : reminderReadiness.state === "attention"
      ? item("delivery", "Reminder delivery has a clean runway", reminderReadiness.detail, "attention")
      : item("delivery", "Reminder delivery has a clean runway", "No failed or stalled reminder delivery is waiting in the queue."));

  checks.push(item("human-check", "One voluntary player check", "Before the first kickoff, have one player sign in and save or replace a pick. This is the only final check that must happen in a real player session.", "manual"));

  const status = checks.some((check) => check.state === "attention")
    ? "attention"
    : checks.some((check) => check.state === "setup")
      ? "setup"
      : "ready";
  return { status, checks };
}
