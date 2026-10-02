export const PICKABLE_GAME_STATUSES = new Set(["scheduled"]);
export const SETTLED_GAME_STATUSES = new Set([
  "final",
  "postponed",
  "cancelled",
  "no_contest",
]);
export const DISRUPTED_GAME_STATUSES = new Set([
  "postponed",
  "cancelled",
  "no_contest",
]);

export function isSettledGameStatus(status) {
  return SETTLED_GAME_STATUSES.has(status);
}
