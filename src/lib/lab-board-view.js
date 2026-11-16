/**
 * The Lab's sample players as a `BoardView` (see board-view.js), so the Lab draws the tote board and the ticket from the same shape the
 * real clubhouse does. `ticket` is what the viewer has sent in; `champion` is the Survivor champion once Survivor is decided.
 */
import { LAB_VIEWER, labKickedOff, labLeaderboard, labStandard, labSurvivorBoard } from "./lab-clubhouse.js";
import { LAB_SLATE, LAB_TEAM_NAMES, labAtsResult, labLineFor, labSurvivorAt } from "./lab-samples.js";

/** Survivor is straight up: the team has to win its game, and a tie is a loss. */
function straightUp(game, team) {
  const other = team === game.home ? game.away : game.home;
  return game.final[team] > game.final[other] ? "W" : "L";
}

/**
 * @param {{ moment: string, viewer?: string, ticket: { picks: string[], survivor: string | null }, champion?: string | null }} options
 * @returns {import("./board-view.js").BoardView}
 */
export function labBoardView({ moment, viewer = LAB_VIEWER, ticket, champion = null }) {
  const games = LAB_SLATE.map((game) => {
    const kickedOff = labKickedOff(LAB_SLATE, game.id, moment);
    return {
      id: game.id,
      kickoff: game.kickoff,
      kickedOff,
      away: game.away,
      home: game.home,
      awayLine: labLineFor(game, game.away),
      homeLine: labLineFor(game, game.home),
      results: Object.fromEntries([game.away, game.home].map((team) => [team, { ats: kickedOff ? labAtsResult(game, team) : null, su: kickedOff ? straightUp(game, team) : null }])),
    };
  });
  const gameOf = (team) => games.find((game) => game.away === team || game.home === team);
  const inOrder = (picks) => games.flatMap((game) => picks.filter((team) => team === game.away || team === game.home));
  const board = labSurvivorBoard({ moment, viewer });

  const rows = labLeaderboard({ round: "regular", moment }).map((row) => {
    const you = row.name === viewer;
    const standard = labStandard(row.name, { round: "regular", moment, viewer });
    const yours = inOrder(ticket.picks).map((team) => { const game = gameOf(team); return { hidden: false, team, line: team === game.away ? game.awayLine : game.homeLine, result: game.results[team].ats }; });
    const slats = (you ? yours : standard.slats).map((slat) => ({ hidden: slat.hidden, team: slat.team, line: slat.line, result: slat.result }));
    const base = you ? [yours[0] ?? null, yours[1] ?? null] : [slats[0] ?? null, slats[1] ?? null];
    /** @type {import("./board-view.js").SurvivorCell} */
    let survivor;
    if (you) survivor = board.out ? { kind: "out" } : ticket.survivor ? { kind: "pick", team: ticket.survivor, result: gameOf(ticket.survivor).results[ticket.survivor].su } : { kind: "owed" };
    else if (standard.survivor === null) survivor = { kind: "out" };
    else if (standard.survivor.hidden) survivor = { kind: "hidden" };
    else survivor = standard.survivor.team ? { kind: "pick", team: standard.survivor.team, result: standard.survivor.result } : { kind: "hidden" };
    return { id: row.name, name: row.name, wins: row.wins, you, slats: base, survivor };
  });

  const used = labSurvivorAt(9).find((seat) => seat.name === viewer)?.weeks.length ?? 0;
  const teams = Object.fromEntries(board.teams.map((entry) => [entry.team, { free: entry.free, usedWeek: entry.usedWeek, used: entry.usedWeek !== null, locked: entry.locked }]));
  return {
    week: "WEEK 10",
    status: "OFFICIAL",
    maxPicks: 2,
    canPick: moment !== "graded",
    weekId: null,
    games,
    names: LAB_TEAM_NAMES,
    rows,
    showSurvivor: true,
    championId: champion,
    champion,
    mine: { picks: inOrder(ticket.picks), survivor: ticket.survivor },
    survivor: { playing: !champion && !board.out, out: board.out, outWeek: board.outWeek, left: 32 - used, teams },
    ids: {},
  };
}
