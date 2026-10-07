/**
 * Fixed sample data for the Standings screenshot baseline: the signed-in
 * player's ticket, the Pick'em Pad, the Survivor Table, and the Bowl Card.
 * The real home page renders in a browser with these responses; no database.
 */

const NAMES = ["Gary", "Connor", "Tyler", "Rick", "Zac", "Ron", "Al", "Dana"];
const TEAMS = [
  ["Los Angeles Rams", "LAR"], ["Green Bay Packers", "GB"], ["Buffalo Bills", "BUF"], ["Kansas City Chiefs", "KC"],
  ["Tennessee Titans", "TEN"], ["Baltimore Ravens", "BAL"], ["San Francisco 49ers", "SF"], ["Philadelphia Eagles", "PHI"],
  ["Detroit Lions", "DET"], ["Dallas Cowboys", "DAL"], ["Houston Texans", "HOU"], ["Seattle Seahawks", "SEA"],
];
const SPREADS = ["-3", "+4.5", "-6", "-7.5", "+11.5", "-9.5", "-2.5", "+3", "-1.5", "+6", "-4", "+2.5"];
const KICKOFFS = [
  "2026-10-04T17:00:00Z", "2026-10-04T17:00:00Z", "2026-10-04T20:25:00Z", "2026-10-05T00:20:00Z",
  "2026-10-04T17:00:00Z", "2026-10-04T17:00:00Z", "2026-10-04T20:25:00Z", "2026-10-06T00:15:00Z",
  "2026-10-04T17:00:00Z", "2026-10-04T20:05:00Z", "2026-10-05T00:20:00Z", "2026-10-04T20:25:00Z",
];

function pick(index, { reveal, result }) {
  const [label, abbreviation] = TEAMS[index % TEAMS.length];
  if (!reveal) return { label: null, isHidden: true, resultMark: "" };
  return {
    label, abbreviation, isHidden: false, resultMark: result, spread: SPREADS[index % SPREADS.length],
    isLineLocked: true, kickoffAt: KICKOFFS[index % KICKOFFS.length],
  };
}

function results(seed, count) {
  // Deterministic mix of wins, losses, and not-yet-graded picks.
  return Array.from({ length: count }, (_, index) => ["W", "L", "", "W", "L", "W"][(seed + index * 2) % 6]);
}

function rows({ maxPicks, playoff }) {
  return NAMES.map((firstName, playerIndex) => {
    const marks = results(playerIndex, maxPicks);
    return {
      id: `p${playerIndex}`,
      firstName,
      wins: 9 - playerIndex + (playoff ? 0 : 3),
      playoffEliminated: playoff && playerIndex >= 6,
      trophies: playerIndex === 0 ? ["Pick'em Champion 2025"] : [],
      picks: Array.from({ length: maxPicks }, (_, slot) => pick(playerIndex * 2 + slot, { reveal: playerIndex !== 5, result: marks[slot] })),
    };
  });
}

function survivorRows({ viewerOutWeek }) {
  return NAMES.map((firstName, playerIndex) => {
    const out = playerIndex === 2 ? viewerOutWeek : playerIndex >= 5 ? 3 : null; // index 2 is the viewer
    const played = out ?? 5;
    const picks = Array.from({ length: 18 }, (_, week) => {
      if (week >= played) return null;
      const lost = out !== null && week === out - 1;
      return { ...pick(playerIndex + week * 3, { reveal: true, result: lost ? "L" : "W" }), abbreviation: TEAMS[(playerIndex + week * 3) % TEAMS.length][1] };
    });
    return {
      id: `s${playerIndex}`, playerId: `p${playerIndex}`, firstName, trophies: [],
      status: out === null ? "active" : "eliminated",
      requiredThisPeriod: out === null || out === 5,
      // The current week's pick: an eliminated player has none this week.
      pick: out === null ? picks[4] : null,
      picks,
    };
  });
}

const base = {
  serverTime: "2026-10-04T18:30:00Z",
  viewerPlayerId: "p2",
  isCommissioner: false,
  seasonSnapshotReleased: false,
  showSurvivorStandings: true,
  showBowlCard: false,
  showPoolChat: false,
  hidePickemEliminatedRows: false,
  hideSurvivorEliminatedRows: false,
  isPlayoff: false,
  week: "Week 5",
  weekStatus: "active",
  maxPicks: 2,
  nextRevealAt: null,
  survivorAvailable: true,
  survivorNotice: null,
  survivorChampionPlayerId: null,
  survivorComplete: false,
  survivorChampionName: null,
};

export const SCENARIOS = {
  // The viewer is still in Survivor: the ticket has its Survivor section.
  "regular-in": { ...base, rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: null }) },
  // The viewer was eliminated in week 2: the ticket is one column.
  "regular-out": { ...base, rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }) },
  // Both tables hide their eliminated rows and the Bowl Card is open.
  "regular-hidden-rows": { ...base, hidePickemEliminatedRows: true, hideSurvivorEliminatedRows: true, showBowlCard: true, rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }) },
  // Survivor has a champion: the section is gone for everyone.
  "regular-complete": { ...base, survivorComplete: true, survivorChampionPlayerId: "p0", survivorChampionName: "Gary", rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }).map((row) => ({ ...row, status: "complete" })) },
  // Wild Card weekend: six picks each, Survivor is over.
  "playoff-wildcard": { ...base, isPlayoff: true, week: "Wild Card", maxPicks: 6, serverTime: "2027-01-10T19:00:00Z", showSurvivorStandings: false, survivorAvailable: false, rows: rows({ maxPicks: 6, playoff: true }), survivorRows: [] },
  // Divisional round: four picks each.
  "playoff-divisional": { ...base, isPlayoff: true, week: "Divisional Round", maxPicks: 4, serverTime: "2027-01-17T19:00:00Z", showSurvivorStandings: false, survivorAvailable: false, rows: rows({ maxPicks: 4, playoff: true }), survivorRows: [] },
  // The off-season after the graded Super Bowl: every table is shown whole whatever the player had hidden, the
  // hide and "− OUT" buttons are gone, and a closed banner leads the page.
  "off-season": { ...base, seasonPhase: "off_season", isPlayoff: true, week: "Super Bowl", weekStatus: "complete", maxPicks: 1, serverTime: "2027-02-20T18:00:00Z", showSurvivorStandings: false, showBowlCard: false, hidePickemEliminatedRows: true, hideSurvivorEliminatedRows: true, survivorAvailable: false, rows: rows({ maxPicks: 1, playoff: true }), survivorRows: [] },
  // The Bowl Card in its other states (the Bowl data for each is BOWL_BY_SCENARIO).
  "bowl-results": { ...base, showBowlCard: true, serverTime: "2026-12-21T15:00:00Z", rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }) },
  "bowl-champion": { ...base, showBowlCard: true, serverTime: "2027-01-12T15:00:00Z", rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }) },
  "bowl-claim-open": { ...base, showBowlCard: true, rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }) },
  "bowl-closed-not-joined": { ...base, showBowlCard: true, rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }) },
  "bowl-minimized": { ...base, showBowlCard: false, rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }) },
  // A commissioner can turn the pad over to the Season Snapshot.
  "commissioner": { ...base, isCommissioner: true, seasonSnapshotReleased: true, rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }) },
};

/** Bowl Pool data per Standings scenario; scenarios not listed use the default Bowl Card. */
export const BOWL_BY_SCENARIO = {
  "bowl-results": { graded: 3, viewerPicks: { "bowl-0": "h0", "bowl-1": "a1", "bowl-2": "h2" } },
  "bowl-champion": { graded: 6, champion: true, viewerPicks: { "bowl-0": "h0", "bowl-1": "a1", "bowl-2": "h2", "bowl-3": "a3", "bowl-4": "h4", "bowl-5": "a5" } },
  "bowl-claim-open": { optedIn: false, entryOpen: true },
  "bowl-closed-not-joined": { optedIn: false, entryOpen: false },
};

export function homeResponse(name) {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`Unknown Standings scenario: ${name}`);
  return scenario;
}

/** Cumulative wins by week for the Season Snapshot, in a fixed order. */
export function seasonSnapshotResponse() {
  const scores = NAMES.map((_, playerIndex) => Array.from({ length: 5 }, (_, week) => Math.max(0, Math.round((week + 1) * (1.8 - playerIndex * 0.12)))));
  return {
    regular: Array.from({ length: 5 }, (_, week) => ({
      id: `week-${week + 1}`, label: `Week ${week + 1}`, complete: week < 4,
      scores: NAMES.map((_, playerIndex) => ({ playerId: `p${playerIndex}`, wins: scores[playerIndex][week] })),
    })),
    playoffs: [],
    colorOrder: NAMES.map((_, playerIndex) => `p${playerIndex}`),
  };
}

// Sample school colors (primary, alternate) as the schedule import saves them.
const BOWL_GAMES = [
  ["Frisco Bowl", ["Memphis", "MEM", "#003087", "#898d8d"], ["Toledo", "TOL", "#15397f", "#ffd200"], "-3.5"],
  ["Cure Bowl", ["Troy", "TROY", "#8a2432", "#b1b3b3"], ["Buffalo", "BUFF", "#005bbb", "#ffffff"], "-1"],
  ["Gasparilla Bowl", ["Georgia Southern", "GSU", "#011e41", "#87714d"], ["Marshall", "MRSH", "#00b140", "#ffffff"], "-6.5"],
  ["Rose Bowl (QF)", ["Ohio State", "OSU", "#bb0000", "#666666"], ["Oregon", "ORE", "#154733", "#fee123"], "-3"],
  ["Salute to Veterans", ["Troy", "TROY", "#8a2432", "#b1b3b3"], ["Buffalo", "BUFF", "#005bbb", "#ffffff"], "-2"],
  ["Frisco Football Classic", ["Memphis", "MEM", "#003087", "#898d8d"], ["Toledo", "TOL", "#15397f", "#ffd200"], "-4"],
].map(([bowl_name, away, home, spread], index) => ({
  id: `bowl-${index}`, bowl_name, status: index === 0 ? "final" : "scheduled", kickoff_at: `2026-12-${19 + index}T18:00:00Z`,
  venue_city: ["Frisco", "Orlando", "Tampa", "Pasadena", "Montgomery", "Frisco"][index], venue_state: ["TX", "FL", "FL", "CA", "AL", "TX"][index], time_confirmed: true,
  away_team_id: `a${index}`, home_team_id: `h${index}`,
  awayTeam: { id: `a${index}`, full_name: away[0], short_name: away[0], abbreviation: away[1], primary_color: away[2], secondary_color: away[3] },
  homeTeam: { id: `h${index}`, full_name: home[0], short_name: home[0], abbreviation: home[1], primary_color: home[2], secondary_color: home[3] },
  line: { favorite_team_id: `h${index}`, locked_spread: spread, locked_at: "2026-12-01T00:00:00Z" },
}));

/** A small Bowl Card for the scenarios that open it. */
export function bowlResponse({ optedIn = true, entryOpen = false, picks = {}, graded = 0, champion = false, viewerPicks = {}, guess = /** @type {number | null} */ (null) } = {}) {
  // `graded` games are final: every player has a deterministic win or loss on each.
  const games = BOWL_GAMES.map((game, index) => ({ ...game, status: index < graded ? "final" : game.status }));
  const publicPicks = NAMES.flatMap((_, playerIndex) => games.slice(0, graded).map((game, gameIndex) => ({
    playerId: `p${playerIndex}`, game_id: game.id, selected_team_id: game.line.favorite_team_id, result: (playerIndex + gameIndex * 2) % 3 === 0 ? "loss" : "win",
  }))).filter((pick) => pick.playerId !== "p2");
  const own = { ...picks, ...viewerPicks };
  return {
    season: { season_year: 2026, championship_game_id: "bowl-3" }, optedIn, entryOpen, entry: optedIn ? { championship_total_guess: guess ?? (graded ? 51 : null) } : null, games,
    standings: NAMES.map((playerName, index) => ({ playerId: `p${index}`, playerName, wins: 4 - (index % 4), losses: index % 3, tiebreakerTotal: graded ? 40 + index : null, trophies: champion && index === 0 ? ["Bowl Pool Champion 2026"] : [] })),
    championships: champion ? [{ playerId: "p0", seasonYear: 2026, playerName: NAMES[0] }] : [],
    publicPicks, ownPicks: Object.entries(own).map(([game_id, selected_team_id]) => ({ game_id, selected_team_id })), ownPreviewSelections: [], automaticResults: [], privatePickMarkers: [],
  };
}
