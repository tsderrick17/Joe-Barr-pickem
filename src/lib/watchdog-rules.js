import { dateFormat } from "./date-format.js";
import { FINAL_OVERDUE_HOURS } from "./final-overdue.js";
import { creditsBelowReserve, PROVIDER_CREDIT_RESERVE } from "./provider-credits.js";

const BOWL_ISSUE_TITLES = {
  teams: "A Bowl Pool game is still missing a team",
  line: "A started Bowl Pool game has no official line",
  final: "A Bowl Pool game is overdue for a final score",
  settlement: "Bowl Pool results do not reconcile",
  structure: "Bowl Pool schedule data is inconsistent",
};

/**
 * @param {{
 *   health: any,
 *   bootstrap: any,
 *   preflightChecks?: Array<{ label: string, passed: boolean }>,
 *   bowlHealth?: { configured?: boolean, healthy?: boolean, problems?: string[], issues?: Array<{ kind: string, message: string }> } | null,
 *   now?: Date,
 * }} input
 */
export function evaluateWatchdogSignals({ health, bootstrap, preflightChecks = [], bowlHealth = null, now = new Date() }) {
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
  const quotaProtected = creditsBelowReserve(health.providerAllowance);
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
  // Below the reserve the score worker stops spending credits, which also silences the stalled-scores alert above: this is the alert that says why.
  // The balance comes from the last score run, so it only counts if that run was this month (credits renew on the 1st) and the NFL season is still on.
  const reportedAt = health.providerCreditSnapshot?.reportedAt ? new Date(health.providerCreditSnapshot.reportedAt) : null;
  const reportedThisMonth = reportedAt !== null && reportedAt.getUTCFullYear() === now.getUTCFullYear() && reportedAt.getUTCMonth() === now.getUTCMonth();
  if (quotaProtected && reportedThisMonth && bootstrap.seasonState !== "complete") {
    signals.push({
      key: "odds-credits-below-reserve", severity: "critical",
      title: "Score provider credits are almost used up",
      detail: `Only ${health.providerAllowance} Odds API credit${health.providerAllowance === 1 ? " is" : "s are"} left this month (${PROVIDER_CREDIT_RESERVE} are kept in reserve). Final-score checks are paused to protect them, so NFL games will not be graded automatically until the credits renew on the 1st or the plan is upgraded.`,
    });
  }
  const overdueFinals = health.overdueFinals ?? [];
  if (overdueFinals.length > 0) {
    signals.push({
      key: "final-overdue-nfl", severity: "critical",
      title: "An NFL game is overdue for a final score",
      detail: `${overdueFinals.map((game) => game.label).join(", ")} ${overdueFinals.length === 1 ? "has" : "have"} no final score ${FINAL_OVERDUE_HOURS}+ hours after kickoff, and automatic checking has stopped for ${overdueFinals.length === 1 ? "it" : "them"}. Open Commissioner Desk → Grading.`,
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
  if (bowlHealth?.configured && !bowlHealth.healthy) {
    // One alert per kind of problem, so a new kind (say a missing line) still alerts while an older one (a team-less game) is already open.
    const issues = bowlHealth.issues?.length ? bowlHealth.issues : [{ kind: "integrity", message: (bowlHealth.problems ?? []).join(" ") || "Bowl Pool schedule, lines, picks, or result receipts failed reconciliation. Open Commissioner Desk → Bowl Pool readiness." }];
    for (const kind of [...new Set(issues.map((issue) => issue.kind))]) {
      signals.push({
        key: `bowl-pool-${kind}-needs-review`, severity: "critical",
        title: BOWL_ISSUE_TITLES[kind] ?? "Bowl Pool integrity needs review",
        detail: `${issues.filter((issue) => issue.kind === kind).map((issue) => issue.message).join(" ")} Open Commissioner Desk → Bowl Pool readiness.`,
      });
    }
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
  const eastern = dateFormat("en-US", { timeZone: "America/New_York", month: "numeric", day: "numeric" })
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
      // Say why each one failed, not just which: the commissioner should not have to open the desk to learn the reason.
      detail: failedPreflight.map((check) => (check.detail ? `${check.label} (${check.detail})` : check.label)).join("; "),
    });
  }
  return signals;
}

// The weekly storage cleanup runs on the first watchdog run once the last one is a week old (or none was ever recorded), not in one fixed
// quarter-hour: if that single run failed or lost a lease race, the cleanup used to wait a whole week. It is safe to run more often, so a failed cleanup
// is simply retried by the next run.
export const STORAGE_PRUNE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function isWeeklyStoragePruneDue(lastPrunedAt, now = new Date()) {
  if (!lastPrunedAt) return true;
  const timestamp = new Date(lastPrunedAt).getTime();
  return !Number.isFinite(timestamp) || now.getTime() - timestamp >= STORAGE_PRUNE_INTERVAL_MS;
}

// A resolved incident that immediately returns is usually provider jitter or a
// short-lived cron miss, not a new emergency. Keep a quiet period per signal so
// the commissioner receives one useful message instead of a reopen/notify loop.
export const WATCHDOG_REPEAT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function isWatchdogRepeatNotificationDue(lastNotifiedAt, now = new Date()) {
  if (!lastNotifiedAt) return true;
  const timestamp = new Date(lastNotifiedAt).getTime();
  return !Number.isFinite(timestamp) || now.getTime() - timestamp >= WATCHDOG_REPEAT_COOLDOWN_MS;
}

function easternDayKey(value) {
  return dateFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function isConfigurationDriftCheckDue(latestRun, now = new Date()) {
  if (!latestRun?.started_at) return true;
  const startedAt = new Date(latestRun.started_at);
  if (Number.isNaN(startedAt.getTime())) return true;
  if (easternDayKey(startedAt) !== easternDayKey(now)) return true;
  return latestRun.status !== "success"
    && now.getTime() - startedAt.getTime() >= 60 * 60 * 1000;
}
