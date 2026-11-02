import { FINAL_SCORE_POLLING_LIMIT_HOURS } from "./score-window.js";
import { SCORE_GATE_INTERVAL_MINUTES, SCORE_RETRY_MINUTES } from "./score-retry-ladder.js";

const MINUTE = 60_000;

export type ScorePollingMode = "regular" | "playoff";

// Both seasons use the same post-kickoff ladder (see score-retry-ladder.js).
export const SCORE_POLLING_RETRY_MINUTES = SCORE_RETRY_MINUTES;

export function scorePollingMode(isPlayoff: boolean): ScorePollingMode {
  return isPlayoff ? "playoff" : "regular";
}

// Past the last gap there are no more automatic checks: the timer is set as far out as polling itself ends, so the database gate never
// wakes the worker for that game again. The Commissioner is alerted that the final is overdue, and the manual button ignores the timer.
function scorePollingDelayMinutes(attempts: number) {
  const index = Math.max(0, attempts - 1);
  return SCORE_POLLING_RETRY_MINUTES[index] ?? FINAL_SCORE_POLLING_LIMIT_HOURS * 60;
}

/**
 * When a game that is still unfinished may be checked again.
 *
 * The database wakes the worker on a fixed clock (every SCORE_GATE_INTERVAL_MINUTES) and the worker starts a few seconds after each tick.
 * Stamping the timer from the run's own start ("3:50:04 + 10 minutes = 4:00:04") leaves it running a few seconds past the next tick, so
 * the game skips that tick and every gap becomes one tick longer than the ladder says. The timer is stamped from the tick the run was called
 * for instead: 3:50:04 counts as 3:50:00, so a 10-minute gap is due at exactly 4:00:00 and the 4:00 tick checks the game. A run that starts a
 * whole tick late costs one tick, once. A game can never be checked twice in one tick, because the gap is at least one tick.
 *
 * A delayed or suspended game should remain visible to the Commissioner, but
 * it must not consume provider credits indefinitely: after the ladder's last gap it is not checked again automatically.
 */
export function nextScoreCheckAt(
  attempts: number,
  now = new Date(),
) {
  const tick = SCORE_GATE_INTERVAL_MINUTES * MINUTE;
  const delayMs = Math.max(scorePollingDelayMinutes(attempts) * MINUTE, tick);
  const thisTick = Math.floor(now.getTime() / tick) * tick;

  return new Date(thisTick + delayMs).toISOString();
}

export function shouldHoldScorePollingForQuota(
  remaining: number | null,
  observedAt: string | null,
  now = new Date(),
  reserve = 50,
) {
  if (remaining === null || remaining >= reserve || !observedAt) return false;
  const observed = new Date(observedAt);
  // The Odds API allowance resets monthly. Never let an old low reading mute
  // the first check of a new calendar month.
  return (
    observed.getUTCFullYear() === now.getUTCFullYear() &&
    observed.getUTCMonth() === now.getUTCMonth()
  );
}
