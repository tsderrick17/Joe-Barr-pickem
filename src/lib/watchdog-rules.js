/** @typedef {{ status: string, started_at: string, completed_at: string | null }} WatchdogScoreRun */
/** @typedef {{ overdueScheduled: number, staleSending: number, overdueTitles?: string[] }} WatchdogReminderHealth */
/** @typedef {{ consecutive_failures: number, next_retry_at: string }} WatchdogProviderCircuit */
/** @typedef {{ id: string, attempted_pins: number }} WatchdogPinAttackIncident */
/** @typedef {{
 *  missingOfficialLines: number,
 *  latestScores: WatchdogScoreRun | null,
 *  scoreChecksDueNow: number,
 *  providerAllowance: number | null,
 *  scoreProviderFailureStreak: number,
 *  scoreCandidates?: number,
 *  reminderHealth: WatchdogReminderHealth,
 *  pendingScheduleReviews: number,
 *  scheduleProviderCircuit?: WatchdogProviderCircuit | null,
 *  pinAttackIncidents?: WatchdogPinAttackIncident[],
 * }} WatchdogHealth */
/** @typedef {{ status: "blocked" | "completed", blockers: string[] }} WatchdogTurnover */
/** @typedef {{ seasonYear: number, loadedGames: number, complete: boolean, seasonState?: string | null, turnover?: WatchdogTurnover | null }} WatchdogBootstrap */
/** @typedef {{ configured: true, healthy: boolean, problems: string[] } | { configured: false, healthy?: boolean, problems?: string[] }} WatchdogBowlHealth */
/** @typedef {{ key: string, severity: "critical" | "warning", title: string, detail: string }} WatchdogSignal */

/**
 * @param {{
 *   health: WatchdogHealth,
 *   bootstrap: WatchdogBootstrap,
 *   preflightChecks?: Array<{ label: string, passed: boolean }>,
 *   bowlHealth?: WatchdogBowlHealth | null,
 *   now?: Date,
 * }} input
 * @returns {WatchdogSignal[]}
 */
export function evaluateWatchdogSignals({ health, bootstrap, preflightChecks = [], bowlHealth = null, now = new Date() }) {
  /** @type {WatchdogSignal[]} */
  const signals = [];
  if (bootstrap.turnover?.status === "blocked") {
    signals.push({
      key: "annual-season-turnover-blocked", severity: "critical",
      title: "Annual season turnover needs review",
      detail: bootstrap.turnover.blockers.join(" ") || "The previous season could not be certified for cleanup.",
    });
  }
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
  const quotaProtected = health.providerAllowance !== null && health.providerAllowance < 50;
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
      detail: `${health.reminderHealth.overdueScheduled} overdue and ${health.reminderHealth.staleSending} stuck sending.${health.reminderHealth.overdueTitles?.length ? ` Waiting: ${health.reminderHealth.overdueTitles.join("; ")}.` : ""} Individual bad email addresses do not trigger this alert.`,
    });
  }
  if (health.pendingScheduleReviews > 0) {
    signals.push({
      key: "schedule-change-review-needed", severity: "critical",
      title: "An NFL schedule change needs review",
      detail: `${health.pendingScheduleReviews} changed game${health.pendingScheduleReviews === 1 ? " is" : "s are"} locked, settled, re-paired, or assigned to another scoring period. Safe schedule corrections continue automatically; these games remain pinned until reviewed.`,
    });
  }
  if (bowlHealth?.configured === true && !bowlHealth.healthy) {
    signals.push({
      key: "bowl-pool-integrity-needs-review", severity: "critical",
      title: "Bowl Pool integrity needs review",
      detail: bowlHealth.problems.join(" ") || "Bowl Pool schedule, lines, picks, or result receipts failed reconciliation. Open Commissioner Desk → Bowl Pool readiness.",
    });
  }
  const scheduleCircuit = health.scheduleProviderCircuit;
  if (scheduleCircuit && scheduleCircuit.consecutive_failures >= 3) {
    signals.push({
      key: "schedule-provider-cooldown", severity: "warning",
      title: "The NFL schedule provider is repeatedly unavailable",
      detail: `${scheduleCircuit.consecutive_failures} consecutive refresh attempts failed. Automatic requests are paused until ${scheduleCircuit.next_retry_at}; the Commissioner can still run an emergency refresh.`,
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
      detail: `The full regular-season schedule is not loaded (${bootstrap.loadedGames} games pinned) after the August 15 safety deadline. Automatic retries continue daily; the manual controls remain available.`,
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

// A resolved incident that immediately returns is usually provider jitter or a
// short-lived cron miss, not a new emergency. Keep a quiet period per signal so
// the commissioner receives one useful message instead of a reopen/notify loop.
export const WATCHDOG_REPEAT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** @param {string | null | undefined} lastNotifiedAt @param {Date} [now] */
export function isWatchdogRepeatNotificationDue(lastNotifiedAt, now = new Date()) {
  if (!lastNotifiedAt) return true;
  const timestamp = new Date(lastNotifiedAt).getTime();
  return !Number.isFinite(timestamp) || now.getTime() - timestamp >= WATCHDOG_REPEAT_COOLDOWN_MS;
}

/** @param {Date} value */
function easternDayKey(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/** @param {{ status?: string | null, started_at?: string | null } | null | undefined} latestRun @param {Date} [now] */
export function isConfigurationDriftCheckDue(latestRun, now = new Date()) {
  if (!latestRun?.started_at) return true;
  const startedAt = new Date(latestRun.started_at);
  if (Number.isNaN(startedAt.getTime())) return true;
  if (easternDayKey(startedAt) !== easternDayKey(now)) return true;
  return latestRun.status !== "success"
    && now.getTime() - startedAt.getTime() >= 60 * 60 * 1000;
}
