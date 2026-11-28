/**
 * Where an NFL game abroad is played. Two sources, so a new city abroad is picked up on its own:
 *  - ESPN's own record of the game (its venue's city and country), asked for every neutral-site game the schedule feed (nflverse)
 *    lists; it is right even when the feed's stadium is not (every 2025 game abroad carried the home team's stadium);
 *  - this list of stadiums abroad, by the name the feed gives ("Tottenham Hotspur Stadium" is London, England), used when ESPN cannot
 *    be reached. The feed's stadium codes are never used (a 2026 game at Tottenham carried JAX00).
 */
const OVERSEAS = [
  [/tottenham/i, "London", "England"],
  [/wembley/i, "London", "England"],
  [/twickenham/i, "London", "England"],
  [/allianz arena|bayern munich|munich/i, "Munich", "Germany"],
  [/deutsche bank park|frankfurt/i, "Frankfurt", "Germany"],
  [/olympiastadion|berlin/i, "Berlin", "Germany"],
  [/azteca|banorte/i, "Mexico City", "Mexico"],
  [/corinthians|neo qu[ií]mica/i, "São Paulo", "Brazil"],
  [/maracan[aã]/i, "Rio de Janeiro", "Brazil"],
  [/melbourne cricket ground/i, "Melbourne", "Australia"],
  [/stade de france/i, "Paris", "France"],
  [/bernab[eé]u/i, "Madrid", "Spain"],
  [/croke park/i, "Dublin", "Ireland"],
];

/**
 * @param {string | null | undefined} stadium  the feed's stadium name
 * @returns {{ city: string, country: string } | null}
 */
export function overseasVenue(stadium) {
  const name = String(stadium ?? "").trim();
  if (!name) return null;
  const found = OVERSEAS.find(([pattern]) => pattern.test(name));
  return found ? { city: found[1], country: found[2] } : null;
}

/**
 * ESPN's venue address for a game, as a place abroad: { city, country } when the country is not the United States, otherwise null.
 * @param {{ city?: string, country?: string } | null | undefined} address
 */
export function espnVenue(address) {
  const city = String(address?.city ?? "").trim(), country = String(address?.country ?? "").trim();
  if (!city || !country || /^(usa|us|united states( of america)?)$/i.test(country)) return null;
  return { city, country };
}

/** "London, England", or null for a game at home. */
export function venueLabel(city, country) {
  return city && country ? `${city}, ${country}` : null;
}
