/**
 * A Survivor selection counts on the personal ticket while the player is
 * eligible for the current scoring period. An elimination recorded during
 * this period still counts for this week's ticket; it changes next period.
 */
export function ticketCompletion({
  isPlayoff = false,
  maxPicks,
  pickemSelections,
  survivorAvailable,
  survivorPickMade,
  survivorStatus,
  survivorRequired,
}) {
  // Survivor ends before the postseason. Keep the ticket truthful even if a
  // stale client response still contains an active Survivor entry.
  const countsSurvivor = !isPlayoff && survivorAvailable && (typeof survivorRequired === "boolean" ? survivorRequired : survivorStatus === "active");
  const requiredSelections = maxPicks + (countsSurvivor ? 1 : 0);
  const selectionsMade =
    pickemSelections + (countsSurvivor && survivorPickMade ? 1 : 0);

  return {
    requiredSelections,
    selectionsMade,
    isFilled: selectionsMade >= requiredSelections,
  };
}
