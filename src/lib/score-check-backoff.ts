const MINUTE = 60_000;

export type ScorePollingMode = "fast" | "balanced" | "conserve";

export function scorePollingMode(remaining: number | null): ScorePollingMode {
  if (remaining !== null && remaining >= 250) return "fast";
  if (remaining !== null && remaining >= 100) return "balanced";
  return "conserve";
}

export function scorePollingDelayMinutes(
  attempts: number,
  remaining: number | null,
) {
  const index = Math.max(0, attempts - 1);
  const mode = scorePollingMode(remaining);
  const delays = mode === "fast"
    ? [5, 5, 5, 5, 5, 5, 10, 15, 30, 60, 120]
    : mode === "balanced"
      ? [10, 10, 10, 10, 15, 15, 30, 60, 120]
      : [15, 15, 15, 15, 30, 30, 60, 120];

  return delays[index] ?? 360;
}

/**
 * A delayed or suspended game should remain visible to the Commissioner, but
 * it must not consume one provider credit every fifteen minutes indefinitely.
 */
export function nextScoreCheckAt(
  attempts: number,
  now = new Date(),
  remaining: number | null = null,
) {
  const delayMinutes = scorePollingDelayMinutes(attempts, remaining);

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
