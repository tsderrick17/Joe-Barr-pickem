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
  // A commissioner can turn the pad over to the Season Snapshot.
  "commissioner": { ...base, isCommissioner: true, seasonSnapshotReleased: true, rows: rows({ maxPicks: 2 }), survivorRows: survivorRows({ viewerOutWeek: 2 }) },
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

const BOWL_GAMES = [
  ["Frisco Bowl", "Memphis", "MEM", "Toledo", "TOL"], ["Cure Bowl", "Troy", "TROY", "Buffalo", "BUFF"],
  ["Gasparilla Bowl", "Georgia Southern", "GSU", "Marshall", "MRSH"], ["Rose Bowl (QF)", "Ohio State", "OSU", "Oregon", "ORE"],
].map(([bowl_name, awayName, awayAbbr, homeName, homeAbbr], index) => ({
  id: `bowl-${index}`, bowl_name, status: index === 0 ? "final" : "scheduled", kickoff_at: `2026-12-${19 + index}T18:00:00Z`,
  away_team_id: `a${index}`, home_team_id: `h${index}`,
  awayTeam: { id: `a${index}`, full_name: awayName, short_name: awayName, abbreviation: awayAbbr },
  homeTeam: { id: `h${index}`, full_name: homeName, short_name: homeName, abbreviation: homeAbbr },
  line: { favorite_team_id: `h${index}` },
}));

/** A small Bowl Card for the scenarios that open it. */
export function bowlResponse() {
  return {
    season: { season_year: 2026 }, games: BOWL_GAMES,
    standings: NAMES.map((playerName, index) => ({ playerId: `p${index}`, playerName, wins: 4 - (index % 4), losses: index % 3, tiebreakerTotal: null, trophies: [] })),
    championships: [], publicPicks: [], ownPicks: [], ownPreviewSelections: [], automaticResults: [], privatePickMarkers: [],
  };
}
