/**
 * Whether a successful player authentication counts as the player using Pick'em, so their "last active" time moves. Every page a player opens
 * reads its data through the shared authentication, so this one rule covers them all (it used to be recorded only on login, the Slate, picks
 * and chat, so someone who only looked at the Standings or the Trophy Room never showed as active). Commissioner-only admin calls do not count:
 * the desk polls them in the background.
 * @param {{ ok: boolean, player?: { active?: boolean } }} access
 * @param {{ requireCommissioner?: boolean }} [options]
 */
export function countsAsActivity(access, options = {}) {
  return Boolean(access.ok && access.player?.active !== false && !options.requireCommissioner);
}
