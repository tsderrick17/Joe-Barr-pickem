/**
 * The Bowl Pool's line rules as pure functions, so they can be tested without a provider or a database.
 *
 * A line is preliminary until its game-day morning lock and fixed afterwards. Pool lines use half points so a
 * pick can never push: a whole-number spread from the odds feed gets a half-point hook (a pick'em stays 0), and a
 * preliminary spread copied from ESPN is rounded up to the next half point. The favorite from ESPN follows its sign
 * (negative favors the home team, positive the away team, zero is a pick'em with no favorite).
 */
export function poolSpreadFromEspn(espnSpread: number) {
  return Math.ceil(Math.abs(espnSpread) * 2) / 2;
}

export function favoriteFromEspn(espnSpread: number, awayTeamId: string | undefined, homeTeamId: string | undefined) {
  return espnSpread < 0 ? homeTeamId ?? null : espnSpread > 0 ? awayTeamId ?? null : null;
}

/** The pool's spread from the odds feed's: a whole number (but not zero) gets a half-point hook. */
export function lockedSpreadFromOdds(sourceSpread: number) {
  return Number.isInteger(sourceSpread) && sourceSpread !== 0 ? sourceSpread + 0.5 : sourceSpread;
}

/** A line saved at or after its lock time is already locked (stamped now); before it, it is preliminary (no stamp). */
export function lockStampFor(lineLockAt: string | Date, now: Date): string | null {
  return now.getTime() >= new Date(lineLockAt).getTime() ? now.toISOString() : null;
}

/** Whether a game's line is due to be locked this run: its lock time has passed and it is not locked yet. */
export function lineIsDueToLock(lineLockAt: string | Date, now: Date, alreadyLocked: boolean) {
  return !alreadyLocked && new Date(lineLockAt).getTime() <= now.getTime();
}
