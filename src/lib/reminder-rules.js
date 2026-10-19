// Survivor ends with the regular season, or sooner when a champion is crowned
// (the last active entry stays "active" in the database, so the entry alone
// would keep reminding the champion). Keeping this rule in the audience layer
// prevents a stale Survivor reminder from reaching anyone once the competition
// is over.
export function isSurvivorReminderApplicable(periodType, championCrowned = false) {
  return periodType === "regular" && !championCrowned;
}
