/**
 * Only a season that is not yet player-visible can bypass Bowl integrity
 * checks. First kickoff does not delay monitoring: the public
 * schedule must already be trustworthy when players can see and pick it.
 *
 * @param {{ player_visible_at: string }} season
 * @param {Date} [now]
 */
export function bowlPoolPrelaunchHealthResult(season, now = new Date()) {
  if (now < new Date(season.player_visible_at)) {
    return { configured: true, healthy: true, problems: [], integrity: null, settlement: null };
  }
  return null;
}
