// Reading ESPN's postseason schedule for the Bowl Pool: which games belong in the pool, what each bowl is called, which of
// our rows it is, and whether ESPN has confirmed a kickoff time. Pure functions; the sync in `sync-bowl-pool.ts` does the saving.
//
// ESPN names the bowl in `competitions[0].notes[0].headline`, not in the event's own `name` (that is the matchup, "Away at
// Home", or "TBD at TBD" before teams are set). Sponsors change every year ("Bush's Boca Raton Bowl" became "Boca Raton
// Bowl"), so a bowl is recognised by the end of its name, not by an exact match, and never by kickoff time alone: moving
// kickoffs and games ESPN adds late are exactly what once crossed one bowl's teams onto another's row.

/** @typedef {{ id?: string; displayName?: string; abbreviation?: string; color?: string; alternateColor?: string; shortDisplayName?: string; location?: string }} EspnTeam */
/** @typedef {{ id: string; name?: string; shortName?: string; date: string; season?: { type?: number }; status?: { type?: { completed?: boolean } }; competitions?: Array<{ timeValid?: boolean; dateValid?: boolean; notes?: Array<{ headline?: string }>; status?: { type?: { completed?: boolean } }; odds?: Array<{ spread?: number; details?: string; provider?: { name?: string } }>; venue?: { fullName?: string; address?: { city?: string; state?: string } }; competitors?: Array<{ id?: string; score?: string | number | null; team?: EspnTeam; homeAway?: "home" | "away" }> }> }} EspnEvent */
/** @typedef {{ id: string; provider_game_id: string | null; bowl_name: string; kickoff_at: string; order_index: number }} OwnGame */

const MINUTE = 60_000;

/** The bowl's name as ESPN prints it, or "" when the event carries none. @param {EspnEvent} event */
export function espnHeadline(event) {
  const notes = event.competitions?.[0]?.notes ?? [];
  return String(notes.find((note) => note?.headline)?.headline ?? "").trim();
}

/**
 * Whether a game belongs in the pool: every FBS bowl and College Football Playoff game. ESPN's postseason list also
 * carries the FCS playoff and the Celebration Bowl (the FCS conference-champions game); the owner chose to leave those out.
 * @param {string} headline
 */
export function headlineIsPoolGame(headline) {
  if (!headline) return false;
  if (/\bfcs\b/i.test(headline) || /celebration bowl/i.test(headline)) return false;
  return /\bbowl\b|college football playoff|\bclassic\b|national championship/i.test(headline);
}

/** @param {string} headline */
export function headlineIsCfp(headline) {
  return /college football playoff|national championship|quarterfinal|semifinal|first round/i.test(headline);
}

/** @param {string} headline */
export function headlineIsChampionship(headline) {
  return /national championship/i.test(headline);
}

/** ESPN gives a game's date before its time; a date with no time is not a kickoff. @param {EspnEvent} event */
export function espnTimeIsConfirmed(event) {
  const competition = event.competitions?.[0];
  return competition?.timeValid !== false && competition?.dateValid !== false && Number.isFinite(Date.parse(event.date));
}

/** @param {EspnTeam | undefined} team */
export function espnTeamIsTbd(team) {
  return !team?.displayName || !team.id || Number(team.id) < 0 || /^tbd$/i.test(team.displayName.trim());
}

/**
 * The words of a bowl's name that identify it. Our own names ("Cotton", "Idaho Potato", "CFP First Round 2") and ESPN's
 * ("College Football Playoff Quarterfinal at the Goodyear Cotton Bowl Classic", "Famous Idaho Potato Bowl") both reduce to
 * a list of words that ends with the bowl's own name.
 * @param {string} raw
 */
export function bowlNameWords(raw) {
  let text = String(raw ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  text = text.replace(/\([^)]*\)/g, " ");
  const host = text.match(/\bat the (.+)$/);
  if (host) text = host[1];
  text = text.replace(/\bpresented by\b.*$/, " ");
  if (/\bfirst round\b/.test(text)) return ["cfp", "first", "round"];
  text = text.replace(/[ʻʼ'’`]/g, "").replace(/\bbowl classic\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  return text.split(" ").filter((word) => word && word !== "bowl");
}

const endsWith = (long, short) => short.length > 0 && short.length <= long.length && short.every((word, index) => word === long[long.length - short.length + index]);

/** How well an ESPN headline names one of our rows: 0 for not at all. @param {string[]} ours @param {string[]} theirs */
function nameScore(ours, theirs) {
  if (!ours.length || !theirs.length) return 0;
  if (ours.length === theirs.length && ours.every((word, index) => word === theirs[index])) return 1000;
  if (endsWith(theirs, ours)) return 500 + ours.length; // ESPN added a sponsor in front of our name
  if (endsWith(ours, theirs)) return 400 + theirs.length; // we kept a sponsor ESPN dropped
  return 0;
}

/**
 * Which ESPN game is each of our rows. A row already linked to an ESPN game keeps it (a postponed game moves, its link does
 * not); everything else is matched by bowl name, closest kickoff breaking ties between identically named games (the four
 * first-round games share one headline). One ESPN game per row and one row per game, always.
 * @param {Array<{ event: EspnEvent; headline: string }>} candidates
 * @param {OwnGame[]} games
 * @returns {Map<string, EspnEvent>} our game id -> ESPN event
 */
export function matchBowlGames(candidates, games) {
  const pairs = [];
  for (const game of games) {
    const ours = bowlNameWords(game.bowl_name);
    for (const candidate of candidates) {
      const distance = Math.abs(Date.parse(game.kickoff_at) - Date.parse(candidate.event.date));
      const linked = game.provider_game_id === `espn:${candidate.event.id}`;
      const score = linked ? 100_000 : nameScore(ours, bowlNameWords(candidate.headline));
      if (score > 0) pairs.push({ game, candidate, score, distance: Number.isFinite(distance) ? distance : Infinity });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.distance - b.distance || a.game.order_index - b.game.order_index);
  const takenGames = new Set();
  const takenEvents = new Set();
  const matched = new Map();
  for (const { game, candidate } of pairs) {
    if (takenGames.has(game.id) || takenEvents.has(candidate.event.id)) continue;
    takenGames.add(game.id);
    takenEvents.add(candidate.event.id);
    matched.set(game.id, candidate.event);
  }
  return matched;
}

/** A new row's name, in the style of the seeded ones ("Cure", "Idaho Potato", "Fiesta"): the bowl's own name, sponsor kept. @param {string} headline */
export function newBowlName(headline) {
  if (/national championship/i.test(headline)) return "National Championship";
  if (/\bfirst round\b/i.test(headline)) return "CFP First Round";
  let text = headline.replace(/\([^)]*\)/g, " ");
  const host = text.match(/\bat the (.+)$/i);
  if (host) text = host[1];
  return text.replace(/\bpresented by\b.*$/i, " ").replace(/\s+bowl classic\s*$/i, "").replace(/\s+bowl\s*$/i, "").replace(/\s+/g, " ").trim();
}

/** Noon Eastern of a calendar date: where a game whose time is not announced waits on its day. @param {string} dateKey "YYYY-MM-DD" @param {(y: number, m: number, d: number, h: number) => Date} easternToUtc */
export function noonEastern(dateKey, easternToUtc) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return easternToUtc(year, month, day, 12);
}

/**
 * What one run of the annual schedule pull should do.
 * - `updates`: our rows that ESPN knows, each with the ESPN game. A kickoff is taken only when ESPN has confirmed it.
 * - `inserts`: pool games ESPN lists that we have no row for.
 * - `ignored`: ESPN games left out on purpose (FCS, the Celebration Bowl, nameless).
 * - `unmatched`: our rows ESPN no longer lists, for the log.
 * @template {OwnGame} G
 * @param {EspnEvent[]} events
 * @param {G[]} games
 */
export function planBowlSchedule(events, games) {
  const candidates = [];
  const ignored = [];
  for (const event of events) {
    const headline = espnHeadline(event);
    if (headlineIsPoolGame(headline)) candidates.push({ event, headline });
    else ignored.push({ id: event.id, headline });
  }
  // A game already linked to an ESPN id stays ours even if ESPN's wording of its headline changed.
  const linkedIds = new Set(games.map((game) => game.provider_game_id).filter(Boolean));
  const linkedExtra = events.filter((event) => linkedIds.has(`espn:${event.id}`) && !candidates.some((candidate) => candidate.event.id === event.id)).map((event) => ({ event, headline: espnHeadline(event) }));
  const matched = matchBowlGames([...candidates, ...linkedExtra], games);
  const used = new Set([...matched.values()].map((event) => event.id));
  const updates = games.filter((game) => matched.has(game.id)).map((game) => ({ game, event: /** @type {EspnEvent} */ (matched.get(game.id)) }));
  const inserts = candidates.filter(({ event }) => !used.has(event.id)).map(({ event, headline }) => ({ event, headline }));
  const unmatched = games.filter((game) => !matched.has(game.id));
  return { updates, inserts, ignored, unmatched };
}

/**
 * The display order after adding games: by kickoff, ties by the order they already had. Only when the existing order is
 * already by kickoff is it renumbered (a curated order is left alone and new games go last).
 * @param {Array<{ id: string; kickoff_at: string; order_index: number }>} rows
 * @returns {Array<{ id: string; order_index: number }>} rows whose number changes
 */
export function chronologicalOrder(rows) {
  const sorted = [...rows].sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at) || a.order_index - b.order_index || a.id.localeCompare(b.id));
  const current = new Map(rows.map((row) => [row.id, row.order_index]));
  return sorted.map((row, index) => ({ id: row.id, order_index: index + 1 })).filter((row) => current.get(row.id) !== row.order_index);
}

/** True when the rows already read in kickoff order (ties aside), so renumbering them by kickoff keeps what the Commissioner sees. @param {Array<{ kickoff_at: string; order_index: number }>} rows */
export function orderIsChronological(rows) {
  const byOrder = [...rows].sort((a, b) => a.order_index - b.order_index);
  return byOrder.every((row, index) => index === 0 || Date.parse(row.kickoff_at) + MINUTE >= Date.parse(byOrder[index - 1].kickoff_at));
}
