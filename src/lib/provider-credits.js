/** Odds API credits kept back: below this the score worker stops spending them, and the watchdog says so. */
export const PROVIDER_CREDIT_RESERVE = 50;

/** True when the provider reported a balance and it is under the reserve. An unreported balance (null) is not low. */
export function creditsBelowReserve(remaining) {
  return remaining !== null && remaining !== undefined && remaining < PROVIDER_CREDIT_RESERVE;
}
