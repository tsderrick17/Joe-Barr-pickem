const MINUTE = 60_000;

// Both seasons use the same predictable post-kickoff ladder. The 10-minute
// worker tick makes the first six windows 10 minutes apart in wall-clock time;
// later windows deliberately widen to preserve provider headroom.
export const SCORE_POLLING_RETRY_MINUTES = [10, 10, 10, 10, 10, 10, 20, 20, 20, 60, 120, 240] as const;

export function scorePollingDelayMinutes(
  attempts: number,
  isPlayoff: boolean,
) {
  const index = Math.max(0, attempts - 1);
  void isPlayoff;
  return SCORE_POLLING_RETRY_MINUTES[index] ?? 120;
}

/**
 * A delayed or suspended game should remain visible to the Commissioner, but
 * it must not consume one provider credit every fifteen minutes indefinitely.
 */
export function nextScoreCheckAt(
  attempts: number,
  now = new Date(),
  isPlayoff = false,
) {
  const delayMinutes = scorePollingDelayMinutes(attempts, isPlayoff);

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

/** Protect the provider reserve only after every eligible game has repeated a delayed check. */
export function shouldProtectScoreProviderQuota(
  eligibleGames: readonly { id: string }[],
  backoffByGameId: ReadonlyMap<string, { attempts: number }>,
  remaining: number | null,
  observedAt: string | null,
  now = new Date(),
) {
  return (
    eligibleGames.length > 0 &&
    eligibleGames.every((game) => (backoffByGameId.get(game.id)?.attempts ?? 0) >= 2) &&
    shouldHoldScorePollingForQuota(remaining, observedAt, now)
  );
}
