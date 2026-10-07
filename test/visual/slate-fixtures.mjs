/**
 * Fixed sample data for the Slate screenshot baseline. The real /board page is
 * rendered in a browser with these responses, so the screenshots show exactly
 * what players see in each state. Nothing here touches a database.
 */

const TEAMS = {
  PIT: "Pittsburgh Steelers", CLE: "Cleveland Browns", IND: "Indianapolis Colts", WAS: "Washington Commanders",
  LAR: "Los Angeles Rams", PHI: "Philadelphia Eagles", CIN: "Cincinnati Bengals", JAX: "Jacksonville Jaguars",
  GB: "Green Bay Packers", TB: "Tampa Bay Buccaneers", HOU: "Houston Texans", DAL: "Dallas Cowboys",
  ARI: "Arizona Cardinals", NYG: "New York Giants", BAL: "Baltimore Ravens", TEN: "Tennessee Titans",
  BUF: "Buffalo Bills", NE: "New England Patriots", CHI: "Chicago Bears", NYJ: "New York Jets",
  MIN: "Minnesota Vikings", MIA: "Miami Dolphins", SF: "San Francisco 49ers", DEN: "Denver Broncos",
  SEA: "Seattle Seahawks", LAC: "Los Angeles Chargers", KC: "Kansas City Chiefs", LV: "Las Vegas Raiders",
  DET: "Detroit Lions", CAR: "Carolina Panthers", ATL: "Atlanta Falcons", NO: "New Orleans Saints",
};
const id = (abbreviation) => abbreviation.toLowerCase();

// [away, home, favorite, spread, kickoff (UTC), international]
const WEEK_FIVE = [
  ["PIT", "CLE", "PIT", 2.5, "2026-10-02T00:15:00Z"],
  ["IND", "WAS", "IND", 3.5, "2026-10-04T13:30:00Z", true],
  ["LAR", "PHI", "LAR", 3, "2026-10-04T17:00:00Z"],
  ["JAX", "CIN", "CIN", 2.5, "2026-10-04T17:00:00Z"],
  ["GB", "TB", "GB", 3.5, "2026-10-04T17:00:00Z"],
  ["DAL", "HOU", "HOU", 3, "2026-10-04T17:00:00Z"],
  ["ARI", "NYG", "ARI", 2.5, "2026-10-04T17:00:00Z"],
  ["TEN", "BAL", "BAL", 11.5, "2026-10-04T17:00:00Z"],
  ["NE", "BUF", "BUF", 6.5, "2026-10-04T17:00:00Z"],
  ["NYJ", "CHI", "CHI", 3.5, "2026-10-04T17:00:00Z"],
  ["MIA", "MIN", "MIN", 10.5, "2026-10-04T20:05:00Z"],
  ["DEN", "SF", "SF", 3, "2026-10-04T20:25:00Z"],
  ["LAC", "SEA", "SEA", 7, "2026-10-04T20:25:00Z"],
  ["KC", "LV", "KC", 4.5, "2026-10-05T00:20:00Z"],
  ["DET", "CAR", "DET", 0, "2026-10-06T00:15:00Z"],
];

const WILD_CARD = [
  ["PIT", "BUF", "BUF", 6, "2027-01-09T21:30:00Z"],
  ["GB", "PHI", "PHI", 4.5, "2027-01-10T01:15:00Z"],
  ["HOU", "KC", "KC", 7.5, "2027-01-10T18:00:00Z"],
  ["LAR", "DET", "DET", 3, "2027-01-10T21:30:00Z"],
  ["DEN", "BAL", "BAL", 9.5, "2027-01-11T01:15:00Z"],
  ["MIN", "SF", "SF", 2.5, "2027-01-12T01:15:00Z"],
];

const PICKERS = ["Tyler", "Mike", "Dana", "Chris", "Pat", "Sam"];

function weeks(activeId) {
  const regular = Array.from({ length: 18 }, (_, index) => ({
    id: `week-${index + 1}`, display_name: `Week ${index + 1}`, display_order: index + 1,
    status: index + 1 < 5 ? "complete" : index + 1 === 5 ? "active" : "upcoming", period_type: "regular", max_picks: 2,
  }));
  const playoff = [["Wild Card", 6], ["Divisional Round", 4], ["Conference Championships", 2], ["Super Bowl", 1]].map(([name, max], index) => ({
    id: `playoff-${index + 1}`, display_name: name, display_order: 19 + index, status: "upcoming", period_type: "playoff", max_picks: max,
  }));
  const all = [...regular, ...playoff];
  if (activeId === "playoff-1") {
    for (const period of all) period.status = period.id === "playoff-1" ? "active" : period.period_type === "regular" ? "complete" : "upcoming";
  }
  return all;
}

/**
 * One game in a given phase. A final game gets a deterministic score; the ATS
 * result follows the favorite and spread.
 */
function game([away, home, favorite, spread, kickoff, international = false], index, { now, phase }) {
  const kickoffMs = Date.parse(kickoff);
  const started = kickoffMs <= now;
  const finished = started && (phase === "complete" || kickoffMs <= now - 4 * 3_600_000);
  const status = !started ? "scheduled" : finished ? "final" : "live";
  // Official lines lock the day before kickoff at 6 PM Eastern for an
  // international game, and on game day for the rest.
  const lockMs = international ? kickoffMs - 19.5 * 3_600_000 : kickoffMs - 4 * 3_600_000;
  const official = now >= lockMs;
  const awayScore = finished ? 17 + ((index * 7) % 15) : null;
  const homeScore = finished ? 14 + ((index * 5) % 17) : null;
  let awayResult = null;
  let homeResult = null;
  if (finished) {
    const favoriteMargin = favorite === away ? awayScore - homeScore : homeScore - awayScore;
    const favoriteCovers = favoriteMargin > spread;
    awayResult = (favorite === away) === favoriteCovers ? "win" : "loss";
    homeResult = awayResult === "win" ? "loss" : "win";
  }
  return {
    id: `g${index}`,
    kickoffAt: kickoff,
    lineLockAt: new Date(lockMs).toISOString(),
    isInternational: international,
    awayTeam: TEAMS[away], homeTeam: TEAMS[home],
    awayTeamAbbreviation: away, homeTeamAbbreviation: home,
    awayTeamId: id(away), homeTeamId: id(home),
    favoriteTeamId: spread === 0 ? id(home) : id(favorite),
    officialSpread: official ? spread : null,
    preliminarySpread: spread,
    spreadSource: official ? "official" : "preliminary",
    spreadLockedAt: official ? new Date(lockMs).toISOString() : null,
    status,
    awayScore, homeScore, awayResult, homeResult,
    awayPickers: started ? PICKERS.filter((_, picker) => (picker + index) % 3 === 0) : [],
    homePickers: started ? PICKERS.filter((_, picker) => (picker + index) % 3 === 1) : [],
  };
}

/**
 * The scenarios a Slate can be in. `now` fixes the clock; the rest choose
 * picks, Survivor, and phase.
 */
export const SCENARIOS = {
  "upcoming-unpicked": { now: "2026-09-30T16:00:00Z", phase: "upcoming", picks: [], survivor: "open" },
  "upcoming-picked": { now: "2026-09-30T16:00:00Z", phase: "upcoming", picks: [["g2", "lar"], ["g7", "ten"]], survivor: "picked" },
  "upcoming-no-survivor": { now: "2026-09-30T16:00:00Z", phase: "upcoming", picks: [["g2", "lar"]], survivor: "hidden" },
  "live-survivor": { now: "2026-10-04T18:30:00Z", phase: "live", picks: [["g1", "ind"], ["g4", "gb"]], survivor: "picked" },
  "live-no-survivor": { now: "2026-10-04T18:30:00Z", phase: "live", picks: [["g1", "ind"], ["g4", "gb"]], survivor: "hidden" },
  "complete-survivor": { now: "2026-10-06T16:00:00Z", phase: "complete", picks: [["g1", "ind"], ["g4", "gb"]], survivor: "picked" },
  "complete-no-survivor": { now: "2026-10-06T16:00:00Z", phase: "complete", picks: [["g1", "ind"], ["g4", "gb"]], survivor: "hidden" },
  "playoff-upcoming": { now: "2027-01-08T16:00:00Z", phase: "upcoming", picks: [["g0", "buf"], ["g3", "lar"]], survivor: "off", playoff: true },
  "playoff-six-picks": { now: "2027-01-08T16:00:00Z", phase: "upcoming", picks: [["g0", "buf"], ["g1", "gb"], ["g2", "kc"], ["g3", "lar"], ["g4", "bal"], ["g5", "sf"]], survivor: "off", playoff: true },
  // The off-season, after the graded Super Bowl: a read-only record with a closed banner and no Submit.
  "off-season": { now: "2027-02-20T18:00:00Z", phase: "complete", picks: [["g0", "buf"], ["g1", "gb"], ["g2", "kc"]], survivor: "off", playoff: true, offSeason: true },
  "playoff-live": { now: "2027-01-10T19:00:00Z", phase: "live", picks: [["g0", "buf"], ["g1", "gb"], ["g2", "kc"]], survivor: "off", playoff: true },
};

export function boardResponse(name) {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`Unknown Slate scenario: ${name}`);
  const now = Date.parse(scenario.now);
  const schedule = scenario.playoff ? WILD_CARD : WEEK_FIVE;
  const games = schedule.map((row, index) => game(row, index, { now, phase: scenario.phase }));
  const survivorPick = scenario.survivor === "picked" ? { game_id: "g8", selected_team_id: "buf" } : null;
  return {
    serverTime: new Date(now).toISOString(),
    games,
    myPicks: scenario.picks.map(([gameId, teamId]) => ({ gameId, teamId })),
    pickem: { playoffEliminated: false },
    survivor: {
      available: scenario.survivor !== "off",
      chipsVisible: scenario.survivor === "open" || scenario.survivor === "picked",
      notice: null,
      status: scenario.survivor === "hidden" ? "eliminated" : "active",
      showOnReceipt: scenario.survivor === "open" || scenario.survivor === "picked",
      pick: survivorPick,
      usedTeamIds: ["kc", "det", "phi", "sf", ...(survivorPick ? ["buf"] : [])],
    },
    showPoolAction: false,
    ...(scenario.offSeason ? { seasonPhase: "off_season" } : {}),
    bootstrap: { weeks: weeks(scenario.playoff ? "playoff-1" : "week-5"), nextWeekAvailableAt: null },
  };
}
