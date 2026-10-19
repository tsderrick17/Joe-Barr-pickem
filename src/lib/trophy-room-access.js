import { bowlPoolLaunchAt } from "./bowl-pool.js";

/** The Trophy Room opens to every player at the same moment the Bowl Pool first does, and then stays open for good (unlike the Bowl Pool, which closes between seasons). */
export const TROPHY_ROOM_FIRST_YEAR = 2026;

export function trophyRoomOpensAt() {
  return bowlPoolLaunchAt(TROPHY_ROOM_FIRST_YEAR);
}

/** @param {number} now milliseconds since the epoch */
export function trophyRoomOpen(now, isCommissioner) {
  return isCommissioner || now >= Date.parse(trophyRoomOpensAt());
}
