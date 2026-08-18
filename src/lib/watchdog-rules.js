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
  if (!quotaProtected && (
    (health.scoreChecksDueNow > 0 && (health.latestScores?.status === "failed" || scoreWorkerStale)) ||
    health.scoreProviderFailureStreak >= 3
  )) {
    const affectedGames = Math.max(health.scoreChecksDueNow, health.scoreCandidates ?? 0);
    signals.push({
      key: "stalled-final-scores", severity: "critical",
      title: "Final-score automation is stalled",
      detail: `${affectedGames} game${affectedGames === 1 ? " needs" : "s need"} a score check and the worker has not completed successfully. Automatic retries are conserving provider credits between attempts.`,
    });
  }
  if (health.reminderHealth.overdueScheduled > 0 || health.reminderHealth.staleSending > 0) {
    signals.push({
      key: "stalled-reminders", severity: "warning",
      title: "A scheduled pool message is stuck",
      detail: `${health.reminderHealth.overdueScheduled} overdue and ${health.reminderHealth.staleSending} stuck sending. Individual bad email addresses do not trigger this alert.`,
    });
  }
  if (health.pendingScheduleReviews > 0) {
    signals.push({
      key: "schedule-change-review-needed", severity: "critical",
      title: "An NFL schedule change needs review",
      detail: `${health.pendingScheduleReviews} changed game${health.pendingScheduleReviews === 1 ? " is" : "s are"} locked, settled, re-paired, or assigned to another scoring period. Safe schedule corrections continue automatically; these games remain pinned until reviewed.`,
    });
  }
  if ((health.scheduleProviderCircuit?.consecutive_failures ?? 0) >= 3) {
    signals.push({
      key: "schedule-provider-cooldown", severity: "warning",
      title: "The NFL schedule provider is repeatedly unavailable",
      detail: `${health.scheduleProviderCircuit.consecutive_failures} consecutive refresh attempts failed. Automatic requests are paused until ${health.scheduleProviderCircuit.next_retry_at}; the Commissioner can still run an emergency refresh.`,
    });
  }
  for (const incident of health.pinAttackIncidents ?? []) {
    signals.push({
      key: `suspicious-pin-attempts-${incident.id}`, severity: "critical",
      title: "Suspicious PIN guessing detected",
      detail: `${incident.attempted_pins} different invalid PINs were tried from one privacy-safe source fingerprint within 15 minutes. No raw PINs, network addresses, or player picks were stored in the alert.`,
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
