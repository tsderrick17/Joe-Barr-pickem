/**
 * When the Trophy Room opens to every player, as an ISO time. It is null while the Trophy Room is the Commissioner's alone, which is how it
 * is now. To open it to players later, set this (for example to bowlPoolLaunchAt(2026), the moment the Bowl Pool first launches); it then
 * stays open for good.
 * @type {string | null}
 */
export const TROPHY_ROOM_PLAYER_OPENS_AT = null;

/**
 * @param {number} now milliseconds since the epoch
 * @param {boolean} isCommissioner
 * @param {string | null} opensAt when it opens to players, or null if it has not been scheduled
 */
export function trophyRoomOpen(now, isCommissioner, opensAt = TROPHY_ROOM_PLAYER_OPENS_AT) {
  return isCommissioner || (opensAt !== null && now >= Date.parse(opensAt));
}
