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

export function isPickableGameStatus(status) {
  return PICKABLE_GAME_STATUSES.has(status);
}

export function isSettledGameStatus(status) {
  return SETTLED_GAME_STATUSES.has(status);
}

export function isDisruptedGameStatus(status) {
  return DISRUPTED_GAME_STATUSES.has(status);
}
