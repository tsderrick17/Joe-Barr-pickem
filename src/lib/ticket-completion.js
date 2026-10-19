/**
 * A Survivor selection counts on the personal ticket while the player is
 * eligible for the current scoring period. An elimination recorded during
 * this period still counts for this week's ticket; it changes next period.
 * Once the pool has a champion the competition is over for everyone, including
 * the champion (whose entry is still "active" in the database): Survivor leaves
 * the ticket and its requirement, whatever the entry says.
 * @param {{
 *   isPlayoff?: boolean,
 *   maxPicks: number,
 *   pickemSelections: number,
 *   survivorAvailable: boolean,
 *   survivorPickMade: boolean,
 *   survivorStatus: string | null,
 *   survivorRequired?: boolean | null,
 * }} ticket
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
  const countsSurvivor = !isPlayoff && survivorAvailable && survivorStatus !== "complete" && (typeof survivorRequired === "boolean" ? survivorRequired : survivorStatus === "active");
  const requiredSelections = maxPicks + (countsSurvivor ? 1 : 0);
  const selectionsMade =
    pickemSelections + (countsSurvivor && survivorPickMade ? 1 : 0);

  return {
    requiredSelections,
    selectionsMade,
    isFilled: selectionsMade >= requiredSelections,
  };
}
