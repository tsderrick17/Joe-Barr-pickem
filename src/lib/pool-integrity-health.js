// @ts-check
import { DISRUPTED_GAME_STATUSES, isSettledGameStatus } from "./game-status-policy.js";
import { weekRolloverAt } from "./week-rollover.js";
import { automaticWeeklyRecapAt } from "./weekly-recap-timing.js";

/**
 * The three pool-integrity probes an external monitor watches. The worker probes already prove that the jobs run; these
 * prove the pool's own outcomes: every game got an official line, the Tuesday recap went out, and a finished week handed
 * over to the next. Each rule only turns unhealthy after the work was due plus a grace that absorbs a late provider or one
 * missed job run, so a monitor never wakes the Commissioner for something that fixes itself.
 */
export const LINE_LOCK_GRACE_MS = 20 * 60_000;
export const LINE_PREVIEW_WINDOW_MS = 3 * 60 * 60_000;
export const RECAP_GRACE_MS = 3 * 60 * 60_000;
export const GRADING_GRACE_MS = 3 * 60 * 60_000;
export const HANDOFF_GRACE_MS = 2 * 60 * 60_000;

/**
 * Every game gets an official line when its lock time arrives (a real line, the last known one, or a pick'em). A game
 * past its lock time without one means line locking failed for it; a game about to lock with no line ever captured
 * will lock as a pick'em because the provider never offered it.
 * @param {{ now: number, games: { id: string, status: string, line_lock_at: string }[], lockedGameIds: Set<string>, capturedLineGameIds: Set<string> }} input
 */
export function assessLinesReady({ now, games, lockedGameIds, capturedLineGameIds }) {
  /** @type {string[]} */
  const missedLock = [];
  /** @type {string[]} */
  const noLineYet = [];
  for (const game of games) {
    if (DISRUPTED_GAME_STATUSES.has(game.status) || lockedGameIds.has(game.id)) continue;
    const lockAt = Date.parse(game.line_lock_at);
    if (lockAt <= now - LINE_LOCK_GRACE_MS) missedLock.push(game.id);
    else if (lockAt > now && lockAt - now <= LINE_PREVIEW_WINDOW_MS && game.status === "scheduled" && !capturedLineGameIds.has(game.id)) noLineYet.push(game.id);
  }
  return { healthy: missedLock.length === 0 && noLineYet.length === 0, missedLock, noLineYet };
}

/**
 * The Tuesday recap for the latest fully settled week must be sent (or deliberately cancelled or suppressed) soon
 * after it is due.
 * @param {{ now: number, settledAt: string | null, reminders: { status: string, cancelled_at: string | null, suppression_reason: string | null }[] }} input
 */
export function assessWeeklyRecap({ now, settledAt, reminders }) {
  if (!settledAt) return { healthy: true, reason: null };
  const dueAt = Date.parse(automaticWeeklyRecapAt(settledAt));
  if (now < dueAt + RECAP_GRACE_MS) return { healthy: true, reason: null };
  const handled = reminders.some((reminder) => reminder.status === "sent" || reminder.status === "cancelled" || reminder.cancelled_at !== null || reminder.suppression_reason !== null);
  return handled ? { healthy: true, reason: null } : { healthy: false, reason: reminders.length ? "recap_not_sent" : "recap_not_queued" };
}

/**
 * Once every game in the active week is settled and graded, the week must hand over to the next one at its scheduled
 * time. Games still being played (the settlement probe watches those), a postponed game (a documented hold) and a week
 * without games are not this probe's concern.
 * @param {{ now: number, active: boolean, games: { status: string, kickoff_at: string, finalized_at: string | null }[], pendingGradeCount: number, nextKickoffAt: string | null }} input
 */
export function assessWeekHandoff({ now, active, games, pendingGradeCount, nextKickoffAt }) {
  if (!active || games.length === 0) return { healthy: true, reason: null };
  if (games.some((game) => !isSettledGameStatus(game.status) || game.status === "postponed")) return { healthy: true, reason: null };
  const settlementTimes = games.map((game) => Date.parse(game.finalized_at ?? game.kickoff_at));
  const lastSettledAt = Math.max(...settlementTimes);
  if (pendingGradeCount > 0) return now > lastSettledAt + GRADING_GRACE_MS ? { healthy: false, reason: "grades_pending" } : { healthy: true, reason: null };
  const rolloverAt = Date.parse(weekRolloverAt({ lastFinalizedAt: new Date(lastSettledAt).toISOString(), nextKickoffAt }));
  return now > rolloverAt + HANDOFF_GRACE_MS ? { healthy: false, reason: "week_not_advanced" } : { healthy: true, reason: null };
}
