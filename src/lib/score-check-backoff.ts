import { SCORE_RETRY_MINUTES } from "./score-retry-ladder.js";

const MINUTE = 60_000;

export type ScorePollingMode = "regular" | "playoff";

// Both seasons use the same post-kickoff ladder (see score-retry-ladder.js).
export const SCORE_POLLING_RETRY_MINUTES = SCORE_RETRY_MINUTES;

export function scorePollingMode(isPlayoff: boolean): ScorePollingMode {
  return isPlayoff ? "playoff" : "regular";
}

function scorePollingDelayMinutes(attempts: number) {
  const index = Math.max(0, attempts - 1);
  return SCORE_POLLING_RETRY_MINUTES[index] ?? 120;
}

/**
 * A delayed or suspended game should remain visible to the Commissioner, but
 * it must not consume one provider credit every fifteen minutes indefinitely.
 */
export function nextScoreCheckAt(
  attempts: number,
  now = new Date(),
) {
  const delayMinutes = scorePollingDelayMinutes(attempts);

  return new Date(now.getTime() + delayMinutes * MINUTE).toISOString();
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
