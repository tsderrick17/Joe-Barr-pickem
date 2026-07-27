/**
 * The submitting player can always see their own pick. Everyone else sees it
 * exactly at the recorded kickoff time, never before.
 */
export function shouldRevealPick({ viewerPlayerId, pickPlayerId, kickoffAt }, now = new Date()) {
  if (viewerPlayerId === pickPlayerId) return true;
  if (!kickoffAt) return false;

  return new Date(kickoffAt).getTime() <= now.getTime();
}
