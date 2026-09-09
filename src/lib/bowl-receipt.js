/**
 * Keep the Bowl receipt concise even though a full season can contain more
 * than forty games. The receipt reports progress and save state rather than
 * trying to squeeze every selection into a tiny strip.
 */
export function bowlReceiptSummary({ selectedCount = 0, totalGames = 0, tiebreaker = "", hasUnsavedChanges = false, isSubmitting = false } = {}) {
  const hasSchedule = totalGames > 0;
  const tiebreakerEntered = String(tiebreaker).trim().length > 0;
  const picksComplete = hasSchedule && selectedCount >= totalGames;
  const complete = picksComplete && tiebreakerEntered;

  if (!hasSchedule) {
    return {
      picksLabel: "—",
      tiebreakerLabel: "—",
      status: "CHECKING",
      state: "quiet",
    };
  }

  if (isSubmitting) {
    return {
      picksLabel: `${selectedCount}/${totalGames}`,
      tiebreakerLabel: tiebreakerEntered ? String(tiebreaker) : "DUE",
      status: "SAVING…",
      state: "quiet",
    };
  }

  if (hasUnsavedChanges) {
    return {
      picksLabel: `${selectedCount}/${totalGames}`,
      tiebreakerLabel: tiebreakerEntered ? String(tiebreaker) : "DUE",
      status: "CHANGED · SUBMIT TO SAVE",
      state: "unsaved",
    };
  }

  if (complete) {
    return {
      picksLabel: `${selectedCount}/${totalGames}`,
      tiebreakerLabel: String(tiebreaker),
      status: "COMPLETE · SAVED",
      state: "complete",
    };
  }

  const missing = Math.max(0, totalGames - selectedCount);
  return {
    picksLabel: `${selectedCount}/${totalGames}`,
    tiebreakerLabel: tiebreakerEntered ? String(tiebreaker) : "DUE",
    status: `SAVED · ${missing ? `${missing} PICK${missing === 1 ? "" : "S"} OPEN` : "TIEBREAKER DUE"}`,
    state: "quiet",
  };
}

/** Compare selections by game/value rather than object insertion order. */
export function bowlSelectionsEqual(first = {}, second = {}) {
  const canonicalize = (values) => Object.fromEntries(
    Object.entries(values).sort(([firstId], [secondId]) => firstId.localeCompare(secondId)),
  );
  return JSON.stringify(canonicalize(first)) === JSON.stringify(canonicalize(second));
}
