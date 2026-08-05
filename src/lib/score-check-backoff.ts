const MINUTE = 60_000;

/**
 * A delayed or suspended game should remain visible to the Commissioner, but
 * it must not consume one provider credit every fifteen minutes indefinitely.
 */
export function nextScoreCheckAt(attempts: number, now = new Date()) {
  const delayMinutes =
    attempts <= 1 ? 15 :
    attempts === 2 ? 30 :
    attempts === 3 ? 60 :
    attempts === 4 ? 120 :
    360;

  return new Date(now.getTime() + delayMinutes * MINUTE).toISOString();
}

export function shouldHoldScorePollingForQuota(
  remaining: number | null,
  observedAt: string | null,
  now = new Date(),
  reserve = 25,
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
