// The Lab clubhouse's sample week: the invented league's picks, as each room shows them. Plain data and arithmetic, no React, so the
// rules the rooms rely on (above all: another player's pick stays hidden until its game kicks off) can be checked on their own.

import { LAB_SLATE, LAB_STANDINGS, LAB_SURVIVOR, labAtsResult, labLineFor } from "./lab-samples.js";

/** The player the Lab is seen as. A player always sees their own picks. */
export const LAB_VIEWER = "Walt";

/** The six Wild Card games, for a playoff week's six picks: favourite first, the line on the favourite, the final. */
export const LAB_WILDCARD = [
  { id: "w1", away: "LAC", home: "HOU", favourite: "HOU", line: -2.5, kickoff: "Sat 4:30 PM", final: { LAC: 12, HOU: 32 } },
  { id: "w2", away: "PIT", home: "BAL", favourite: "BAL", line: -9.5, kickoff: "Sat 8:00 PM", final: { PIT: 14, BAL: 28 } },
  { id: "w3", away: "DEN", home: "BUF", favourite: "BUF", line: -8.5, kickoff: "Sun 1:00 PM", final: { DEN: 7, BUF: 31 } },
  { id: "w4", away: "GB", home: "PHI", favourite: "PHI", line: -4.5, kickoff: "Sun 4:30 PM", final: { GB: 10, PHI: 22 } },
  { id: "w5", away: "WAS", home: "TB", favourite: "TB", line: -3, kickoff: "Sun 8:00 PM", final: { WAS: 23, TB: 20 } },
  { id: "w6", away: "MIN", home: "LAR", favourite: "MIN", line: -1, kickoff: "Mon 8:00 PM", final: { MIN: 9, LAR: 27 } },
];

/**
 * The week's moments a room can be set to. "before": no game has kicked off. "gameday": the first two games are final and the rest
 * have not kicked off. "graded": every game is final.
 */
export const LAB_MOMENTS = [
  { id: "before", label: "Before kickoff" },
  { id: "gameday", label: "Game day" },
  { id: "graded", label: "Graded" },
];

/** Each player's picks: two of the four regular games, and six Wild Card picks (one side of every game). */
const REGULAR_PICKS = {
  Earl: ["PIT", "IND"], Walt: ["PIT", "LAR"], Dottie: ["IND", "SF"], Rosie: ["CLE", "PHI"], June: ["IND", "DEN"],
  Lou: ["PIT", "PHI"], Marge: ["WAS", "SF"], Hank: ["CLE", "LAR"], Bev: ["IND", "PHI"], Gus: ["WAS", "DEN"],
};
const WILDCARD_PICKS = {
  Earl: ["HOU", "BAL", "BUF", "PHI", "WAS", "LAR"], Walt: ["HOU", "BAL", "DEN", "PHI", "TB", "LAR"],
  Dottie: ["LAC", "BAL", "BUF", "PHI", "WAS", "MIN"], Rosie: ["HOU", "PIT", "BUF", "GB", "WAS", "LAR"],
  June: ["HOU", "BAL", "BUF", "GB", "TB", "MIN"], Lou: ["LAC", "PIT", "BUF", "PHI", "TB", "LAR"],
  Marge: ["HOU", "BAL", "DEN", "GB", "WAS", "MIN"], Hank: ["LAC", "BAL", "BUF", "PHI", "TB", "LAR"],
  Bev: ["HOU", "PIT", "DEN", "PHI", "WAS", "MIN"], Gus: ["LAC", "PIT", "DEN", "GB", "TB", "MIN"],
};
/** Week 10's Survivor picks, for the players still in after week 9: each a team they have not used, on this week's board. */
export const LAB_WEEK10_SURVIVOR = { Walt: "DEN", Rosie: "WAS", Dottie: "PIT", Earl: "IND", June: "IND" };

/** Players out of the playoff race by the Wild Card round in the sample. */
export const LAB_WILDCARD_OUT = ["Bev", "Gus"];

/** Wins going into the Wild Card round (the playoffs count from the regular season's record). */
const WILDCARD_STANDINGS = [
  { name: "Earl", wins: 21 }, { name: "Walt", wins: 20 }, { name: "Dottie", wins: 20 }, { name: "Rosie", wins: 19 }, { name: "June", wins: 18 },
  { name: "Lou", wins: 17 }, { name: "Marge", wins: 17 }, { name: "Hank", wins: 16 }, { name: "Bev", wins: 13 }, { name: "Gus", wins: 12 },
];

/** Whether a game has kicked off at a moment: none before, the first two on game day, all once graded. */
export function labKickedOff(games, gameId, moment) {
  if (moment === "graded") return true;
  if (moment === "gameday") return games.findIndex((game) => game.id === gameId) < 2;
  return false;
}

/**
 * One player's standard: a slat per pick, in kickoff order. A slat is hidden (a lock, no team) when it is another player's pick and
 * its game has not kicked off; a kicked-off game that is final shows W or L; the viewer's own picks always show.
 * @param {string} name
 * @param {{ round: "regular" | "wildcard", moment: string, viewer?: string }} options
 */
export function labStandard(name, { round, moment, viewer = LAB_VIEWER }) {
  const games = round === "wildcard" ? LAB_WILDCARD : LAB_SLATE;
  const picks = (round === "wildcard" ? WILDCARD_PICKS : REGULAR_PICKS)[name] ?? [];
  const slats = games
    .map((game) => ({ game, team: picks.find((team) => team === game.away || team === game.home) }))
    .filter((entry) => entry.team)
    .map(({ game, team }) => {
      const started = labKickedOff(games, game.id, moment);
      if (!started && name !== viewer) return { gameId: game.id, hidden: true, team: null, line: null, result: null };
      return { gameId: game.id, hidden: false, team, line: labLineFor(game, team), result: started ? labAtsResult(game, team) : null };
    });
  // Survivor rides on the regular week only (it runs through the regular season), for players still in. Like a pick, another
  // player's Survivor team stays hidden until its game kicks off.
  const survivorTeam = round === "regular" ? LAB_WEEK10_SURVIVOR[name] ?? null : null;
  const survivorGame = survivorTeam ? games.find((game) => game.away === survivorTeam || game.home === survivorTeam) : null;
  const survivorHidden = Boolean(survivorGame) && name !== viewer && !labKickedOff(games, survivorGame.id, moment);
  return {
    name,
    slats,
    survivor: survivorTeam ? { team: survivorHidden ? null : survivorTeam, hidden: survivorHidden } : null,
  };
}

/**
 * The leaderboard: every player with their place (level players share it), wins, how far back of the leader, and whether they are out
 * of the playoff race. A graded week adds that week's wins.
 * @param {{ round: "regular" | "wildcard", moment: string }} options
 */
export function labLeaderboard({ round, moment }) {
  const base = round === "wildcard" ? WILDCARD_STANDINGS : LAB_STANDINGS;
  const rows = base.map(({ name, wins }) => {
    const week = labStandard(name, { round, moment, viewer: name }).slats.filter((slat) => slat.result === "W").length;
    return { name, wins: wins + week, out: round === "wildcard" && LAB_WILDCARD_OUT.includes(name) };
  });
  rows.sort((a, b) => Number(a.out) - Number(b.out) || b.wins - a.wins || a.name.localeCompare(b.name));
  const leader = rows[0]?.wins ?? 0;
  return rows.map((row) => ({
    ...row,
    place: row.out ? null : 1 + rows.filter((other) => !other.out && other.wins > row.wins).length,
    tied: !row.out && rows.filter((other) => !other.out && other.wins === row.wins).length > 1,
    back: row.out ? null : leader - row.wins,
  }));
}

/**
 * The Slate board's Survivor side for the viewer: each team on the board is free, used (the week it was used), or locked (its game has
 * kicked off). A player who is out sees the board read only.
 * @param {{ moment: string, viewer?: string }} options
 */
export function labSurvivorBoard({ moment, viewer = LAB_VIEWER }) {
  const run = LAB_SURVIVOR[viewer] ?? [];
  const lostAt = run.findIndex(([, result]) => result === "L");
  const out = lostAt >= 0;
  // The week on the board is week 10: every earlier pick is used.
  const used = new Map(run.map(([team], index) => [team, index + 1]));
  const teams = LAB_SLATE.flatMap((game) => [game.away, game.home].map((team) => {
    const locked = labKickedOff(LAB_SLATE, game.id, moment);
    return { team, gameId: game.id, usedWeek: used.get(team) ?? null, locked, free: !out && !locked && !used.has(team) };
  }));
  return { out, outWeek: out ? lostAt + 1 : null, teams };
}
