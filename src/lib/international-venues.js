/**
 * Where an NFL game abroad is played, from the stadium the schedule feed (nflverse) names: "Tottenham Hotspur Stadium" is London,
 * England. Only stadiums outside the United States are listed; a game anywhere else has no place shown. The feed's own stadium codes
 * are not used, because they are sometimes the home team's (a 2026 game at Tottenham carried JAX00).
 * Add a stadium here when the NFL schedules a game at a new one abroad.
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

/** "London, England", or null for a game at home. */
export function venueLabel(city, country) {
  return city && country ? `${city}, ${country}` : null;
}
