/**
 * The status values the database allows (CHECK constraints in the migrations), in one place. Several
 * hand-written copies of the game list used to disagree: three left out `no_contest`, so a game in that
 * state would have been accepted by the database and quietly mistyped here. Columns are `text` in the
 * generated types, so a route narrows a value with these helpers instead of writing its own union.
 */
export const GAME_STATUSES = ["scheduled", "live", "final", "postponed", "cancelled", "no_contest"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const PERIOD_STATUSES = ["upcoming", "active", "complete"] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const PERIOD_TYPES = ["regular", "playoff"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

/** Narrows a database value. A value the constraint does not allow is a bug, so it fails loudly. */
function narrow<T extends string>(allowed: readonly T[], what: string) {
  return (value: string): T => {
    if ((allowed as readonly string[]).includes(value)) return value as T;
    throw new Error(`Unexpected ${what} from the database.`);
  };
}

export const asGameStatus = narrow(GAME_STATUSES, "game status");
export const asPeriodStatus = narrow(PERIOD_STATUSES, "scoring period status");
export const asPeriodType = narrow(PERIOD_TYPES, "scoring period type");
