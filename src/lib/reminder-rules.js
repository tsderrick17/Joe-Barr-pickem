// Survivor ends with the regular season. Keeping this rule in the audience
// layer prevents a stale Survivor reminder from reaching anyone after the
// playoffs have opened.
export function isSurvivorReminderApplicable(periodType) {
  return periodType === "regular";
}
