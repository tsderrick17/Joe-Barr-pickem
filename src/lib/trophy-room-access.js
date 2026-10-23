/**
 * When the Trophy Room opens to every player, as an ISO time (null would keep it the Commissioner's alone). It opened on 2026-10-23 and then
 * stays open for good.
 * @type {string | null}
 */
export const TROPHY_ROOM_PLAYER_OPENS_AT = "2026-10-23T12:00:00.000Z";

/**
 * @param {number} now milliseconds since the epoch
 * @param {boolean} isCommissioner
 * @param {string | null} opensAt when it opens to players, or null if it has not been scheduled
 */
export function trophyRoomOpen(now, isCommissioner, opensAt = TROPHY_ROOM_PLAYER_OPENS_AT) {
  return isCommissioner || (opensAt !== null && now >= Date.parse(opensAt));
}
