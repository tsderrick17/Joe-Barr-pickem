export function evaluateWatchdogSignals({ health, bootstrap, preflightChecks = [], now = new Date() }) {
  const signals = [];
  if (health.missingOfficialLines > 0) {
    signals.push({
      key: "missing-official-lines", severity: "critical",
      title: "Official lines missed their lock",
      detail: `${health.missingOfficialLines} game${health.missingOfficialLines === 1 ? " is" : "s are"} past line lock without an official line. Open Commissioner Desk → Game day now.`,
    });
  }
  const latestScoreTime = health.latestScores
    ? new Date(health.latestScores.completed_at ?? health.latestScores.started_at).getTime()
    : 0;
  const scoreWorkerStale = !latestScoreTime || now.getTime() - latestScoreTime > 45 * 60 * 1000;
  const quotaProtected = health.providerAllowance !== null && health.providerAllowance < 25;
  if (health.scoreChecksDueNow > 0 && !quotaProtected
    && (health.latestScores?.status === "failed" || scoreWorkerStale)) {
    signals.push({
      key: "stalled-final-scores", severity: "critical",
      title: "Final-score automation is stalled",
      detail: `${health.scoreChecksDueNow} game${health.scoreChecksDueNow === 1 ? " needs" : "s need"} a score check and the worker has not completed successfully within 45 minutes.`,
    });
  }
  if (health.reminderHealth.overdueScheduled > 0 || health.reminderHealth.staleSending > 0) {
    signals.push({
      key: "stalled-reminders", severity: "warning",
      title: "A scheduled pool message is stuck",
      detail: `${health.reminderHealth.overdueScheduled} overdue and ${health.reminderHealth.staleSending} stuck sending. Individual bad email addresses do not trigger this alert.`,
    });
  }
  const eastern = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "numeric", day: "numeric" })
    .formatToParts(now);
  const month = Number(eastern.find((part) => part.type === "month")?.value);
  const day = Number(eastern.find((part) => part.type === "day")?.value);
  const scheduleDeadlineReached = (month === 8 && day >= 15) || month === 9;
  if (scheduleDeadlineReached && !bootstrap.complete && bootstrap.seasonState !== "complete") {
    signals.push({
      key: "season-schedule-missing", severity: "critical",
      title: `${bootstrap.seasonYear} season schedule is not loaded`,
      detail: `${bootstrap.loadedGames}/272 regular-season games are pinned after the August 15 safety deadline. Automatic retries continue daily; the manual controls remain available.`,
    });
  }
  const failedPreflight = preflightChecks.filter((check) => !check.passed);
  if (failedPreflight.length > 0) {
    signals.push({
      key: "automation-configuration-missing", severity: "critical",
      title: "Scheduled automation configuration is incomplete",
      detail: failedPreflight.map((check) => check.label).join(", "),
    });
  }
  return signals;
}
