/**
 * The Workshop Lab's sample league: invented players, real NFL teams, a made-up season. Nothing here is pool data, and nothing
 * here is read from or written to the database. The Lab's prototypes draw from it so every one shows the same little league.
 */

/** The 32 teams, by conference and division, in the order a layout sets them out. */
export const LAB_DIVISIONS = [
  { conference: "AFC", name: "East", teams: ["BUF", "MIA", "NE", "NYJ"] },
  { conference: "AFC", name: "North", teams: ["BAL", "CIN", "CLE", "PIT"] },
  { conference: "AFC", name: "South", teams: ["HOU", "IND", "JAX", "TEN"] },
  { conference: "AFC", name: "West", teams: ["DEN", "KC", "LV", "LAC"] },
  { conference: "NFC", name: "East", teams: ["DAL", "NYG", "PHI", "WAS"] },
  { conference: "NFC", name: "North", teams: ["CHI", "DET", "GB", "MIN"] },
  { conference: "NFC", name: "South", teams: ["ATL", "CAR", "NO", "TB"] },
  { conference: "NFC", name: "West", teams: ["ARI", "LAR", "SF", "SEA"] },
];

export const LAB_TEAM_NAMES = {
  ARI: "Cardinals", ATL: "Falcons", BAL: "Ravens", BUF: "Bills", CAR: "Panthers", CHI: "Bears", CIN: "Bengals", CLE: "Browns",
  DAL: "Cowboys", DEN: "Broncos", DET: "Lions", GB: "Packers", HOU: "Texans", IND: "Colts", JAX: "Jaguars", KC: "Chiefs",
  LAC: "Chargers", LAR: "Rams", LV: "Raiders", MIA: "Dolphins", MIN: "Vikings", NE: "Patriots", NO: "Saints", NYG: "Giants",
  NYJ: "Jets", PHI: "Eagles", PIT: "Steelers", SEA: "Seahawks", SF: "49ers", TB: "Buccaneers", TEN: "Titans", WAS: "Commanders",
};

/** Ten invented players. None is a pool member. */
export const LAB_PLAYERS = ["Walt", "Rosie", "Hank", "Dottie", "Gus", "Marge", "Earl", "Bev", "Lou", "June"];

/**
 * Each player's Survivor run, week 1 onward: [team, result]. "W" won, "L" lost (the run ends there). Runs are as long as the
 * player lasted; a run with no "L" is still alive after the last week shown.
 */
export const LAB_SURVIVOR = {
  Walt: [["BUF", "W"], ["DET", "W"], ["KC", "W"], ["PHI", "W"], ["BAL", "W"], ["SF", "W"], ["GB", "W"], ["HOU", "W"], ["LAR", "W"]],
  Rosie: [["KC", "W"], ["BUF", "W"], ["DET", "W"], ["SF", "W"], ["PHI", "W"], ["MIN", "W"], ["CIN", "W"], ["PIT", "W"], ["TB", "W"]],
  Hank: [["PHI", "W"], ["BAL", "W"], ["CIN", "L"]],
  Dottie: [["DET", "W"], ["KC", "W"], ["BUF", "W"], ["BAL", "W"], ["GB", "W"], ["PHI", "W"], ["SEA", "W"], ["LAC", "W"], ["DEN", "W"]],
  Gus: [["SF", "W"], ["DAL", "L"]],
  Marge: [["BAL", "W"], ["PHI", "W"], ["SF", "W"], ["DET", "W"], ["KC", "W"], ["BUF", "W"], ["HOU", "L"]],
  Earl: [["GB", "W"], ["SF", "W"], ["PHI", "W"], ["KC", "W"], ["DET", "W"], ["BAL", "W"], ["BUF", "W"], ["MIN", "W"], ["LAR", "W"]],
  Bev: [["CIN", "W"], ["KC", "W"], ["MIA", "L"]],
  Lou: [["HOU", "W"], ["DET", "W"], ["BAL", "W"], ["BUF", "W"], ["SF", "W"], ["KC", "W"], ["PHI", "W"], ["GB", "W"], ["TB", "L"]],
  June: [["DAL", "W"], ["BUF", "W"], ["KC", "W"], ["PHI", "W"], ["DET", "W"], ["GB", "W"], ["BAL", "W"], ["SEA", "W"], ["DEN", "W"]],
};

/**
 * The Survivor table as of a week (1-based, at most the longest run): each seat's weeks so far, whether the seat is still in,
 * and the team on the felt this week. A run that ended before this week stays out; one that ends this week shows its loss.
 */
export function labSurvivorAt(week) {
  return LAB_PLAYERS.map((name) => {
    const run = LAB_SURVIVOR[name].slice(0, week);
    const lost = run.findIndex(([, result]) => result === "L");
    const weeks = lost >= 0 ? run.slice(0, lost + 1) : run;
    const out = lost >= 0;
    const current = weeks.length === week ? weeks[week - 1] : null;
    return { name, weeks: weeks.map(([team, result], index) => ({ week: index + 1, team, result })), out, outWeek: out ? lost + 1 : null, current: current ? { team: current[0], result: current[1] } : null };
  });
}

/** The Survivor weeks the table can be set to, each a little story: early, the middle with some out, and the last week. */
export const LAB_SURVIVOR_SCENES = [
  { id: "week-3", label: "Week 3", week: 3 },
  { id: "week-7", label: "Week 7", week: 7 },
  { id: "week-9", label: "Week 9", week: 9 },
];

/** A sample week's games for the betting slip: favourite first, the line on the favourite, a final score once graded. */
export const LAB_SLATE = [
  { id: "g1", away: "PIT", home: "CLE", favourite: "PIT", line: -2.5, kickoff: "Thu 8:15 PM", final: { PIT: 17, CLE: 14 } },
  { id: "g2", away: "IND", home: "WAS", favourite: "IND", line: -3.5, kickoff: "Sun 1:00 PM", final: { IND: 24, WAS: 19 } },
  { id: "g3", away: "LAR", home: "PHI", favourite: "PHI", line: -3, kickoff: "Sun 1:00 PM", final: { LAR: 23, PHI: 20 } },
  { id: "g4", away: "SF", home: "DEN", favourite: "SF", line: -3, kickoff: "Sun 4:25 PM", final: { SF: 20, DEN: 20 } },
];

/** The line as a pick of `team` reads it: "-3.5" for the favourite, "+3.5" for the other side, "PK" for none. */
export function labLineFor(game, team) {
  if (!game.line) return "PK";
  const value = team === game.favourite ? game.line : -game.line;
  return `${value > 0 ? "+" : ""}${value}`;
}

/** An against-the-spread result for a pick of `team` in a finished game: "W" covers, anything else (a push too) is "L". */
export function labAtsResult(game, team) {
  const other = team === game.home ? game.away : game.home;
  const margin = game.final[team] - game.final[other];
  const spread = team === game.favourite ? game.line : -game.line;
  return margin + spread > 0 ? "W" : "L";
}

/** Sample Pick'em standings after week 9 (two picks a week, so 18 at most), best first. */
export const LAB_STANDINGS = [
  { name: "Earl", wins: 13 }, { name: "Walt", wins: 12 }, { name: "Dottie", wins: 12 }, { name: "Rosie", wins: 11 }, { name: "June", wins: 10 },
  { name: "Lou", wins: 9 }, { name: "Marge", wins: 9 }, { name: "Hank", wins: 8 }, { name: "Bev", wins: 7 }, { name: "Gus", wins: 6 },
];
