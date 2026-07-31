/**
 * A Survivor selection counts on the personal ticket only while that player
 * still has an active Survivor entry. This keeps the ticket honest after an
 * elimination or after the pool crowns its champion.
 */
export function ticketCompletion({
  maxPicks,
  pickemSelections,
  survivorAvailable,
  survivorPickMade,
  survivorStatus,
}) {
  const survivorRequired = survivorAvailable && survivorStatus === "active";
  const requiredSelections = maxPicks + (survivorRequired ? 1 : 0);
  const selectionsMade =
    pickemSelections + (survivorRequired && survivorPickMade ? 1 : 0);

  return {
    requiredSelections,
    selectionsMade,
    isFilled: selectionsMade >= requiredSelections,
  };
}
