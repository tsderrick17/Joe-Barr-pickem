/**
 * The Lab's sample players as a `BoardView` (see board-view.js), so the Lab draws the tote board and the ticket from the same shape the
 * real clubhouse does. `ticket` is what the viewer has sent in; `champion` is the Survivor champion once Survivor is decided.
 */
import { coverMargin } from "./board-view.js";
import { LAB_VIEWER, LAB_WILDCARD, labKickedOff, labLeaderboard, labStandard, labSurvivorBoard } from "./lab-clubhouse.js";
import { LAB_SLATE, LAB_TEAM_NAMES, labAtsResult, labLineFor, labSurvivorAt } from "./lab-samples.js";

/** Survivor is straight up: the team has to win its game, and a tie is a loss. */
function straightUp(game, team) {
  const other = team === game.home ? game.away : game.home;
  return game.final[team] > game.final[other] ? "W" : "L";
}

/**
 * `round` "wildcard" is the sample Wild Card round: a pick for every game, no Survivor, and the race to catch the leader.
 * @param {{ moment: string, viewer?: string, ticket: { picks: string[], survivor: string | null }, champion?: string | null, round?: "regular" | "wildcard" }} options
 * @returns {import("./board-view.js").BoardView}
 */
export function labBoardView({ moment, viewer = LAB_VIEWER, ticket, champion = null, round = "regular" }) {
  const playoff = round === "wildcard";
  const slate = playoff ? LAB_WILDCARD : LAB_SLATE;
  const games = slate.map((game) => {
    const kickedOff = labKickedOff(slate, game.id, moment);
    return {
      id: game.id,
      kickoff: game.kickoff,
      kickedOff,
      action: true,
      away: game.away,
      home: game.home,
      awayLine: labLineFor(game, game.away),
      homeLine: labLineFor(game, game.home),
      results: Object.fromEntries([game.away, game.home].map((team) => {
        const other = team === game.home ? game.away : game.home;
        return [team, { ats: kickedOff ? labAtsResult(game, team) : null, su: kickedOff ? straightUp(game, team) : null, score: kickedOff ? game.final[team] : null, margin: kickedOff ? coverMargin(game.final[team], game.final[other], labLineFor(game, team)) : null, pickers: [] }];
      })),
    };
  });
  const gameOf = (team) => games.find((game) => game.away === team || game.home === team);
  const inOrder = (picks) => games.flatMap((game) => picks.filter((team) => team === game.away || team === game.home));
  const board = labSurvivorBoard({ moment, viewer });

  const rows = labLeaderboard({ round, moment }).map((row) => {
    const you = row.name === viewer;
    const standard = labStandard(row.name, { round, moment, viewer });
    const yours = inOrder(ticket.picks).map((team) => { const game = gameOf(team); return { hidden: false, team, line: team === game.away ? game.awayLine : game.homeLine, result: game.results[team].ats }; });
    const slats = (you ? yours : standard.slats).map((slat) => ({ hidden: slat.hidden, team: slat.team, line: slat.line, result: slat.result }));
    // A playoff round: one column a game, each pick under its own game.
    const base = playoff
      ? games.map((game) => (you ? yours : slats).find((slat, index) => (you ? slat.team === game.away || slat.team === game.home : standard.slats[index]?.gameId === game.id)) ?? null)
      : you ? [yours[0] ?? null, yours[1] ?? null] : [slats[0] ?? null, slats[1] ?? null];
    /** @type {import("./board-view.js").SurvivorCell} */
    let survivor;
    if (you) survivor = board.out ? { kind: "out" } : ticket.survivor ? { kind: "pick", team: ticket.survivor, result: gameOf(ticket.survivor).results[ticket.survivor].su } : { kind: "owed" };
    else if (standard.survivor === null) survivor = { kind: "out" };
    else if (standard.survivor.hidden) survivor = { kind: "hidden" };
    else survivor = standard.survivor.team ? { kind: "pick", team: standard.survivor.team, result: standard.survivor.result } : { kind: "hidden" };
    const race = playoff ? { out: row.out, forfeited: false, back: row.back } : {};
    return { id: row.name, name: row.name, wins: row.wins, you, slats: base, survivor, ...race };
  });

  // Once a game has kicked off, each side names the players who took it (a hidden pick is not named).
  for (const game of games) if (game.kickedOff) for (const team of [game.away, game.home]) game.results[team].pickers = rows.filter((row) => row.slats.some((slat) => slat && !slat.hidden && slat.team === team)).map((row) => row.name);

  const used = labSurvivorAt(9).find((seat) => seat.name === viewer)?.weeks.length ?? 0;
  const teams = Object.fromEntries(board.teams.map((entry) => [entry.team, { free: entry.free, usedWeek: entry.usedWeek, used: entry.usedWeek !== null, locked: entry.locked }]));
  const leaderWins = Math.max(...rows.map((row) => row.wins));
  const me = rows.find((row) => row.you);
  return {
    week: playoff ? "WILD CARD" : "WEEK 10",
    status: "OFFICIAL",
    maxPicks: playoff ? games.length : 2,
    canPick: moment !== "graded" && !(playoff && me?.out),
    weekId: null,
    weeks: [],
    poolAction: false,
    games,
    names: LAB_TEAM_NAMES,
    rows,
    showSurvivor: !playoff,
    championId: champion,
    champion,
    mine: { picks: inOrder(ticket.picks), survivor: ticket.survivor },
    survivor: { playing: !playoff && !champion && !board.out, out: board.out, outWeek: board.outWeek, left: 32 - used, teams },
    ids: {},
    playoff: playoff ? {
      leaders: rows.filter((row) => !row.out && row.wins === leaderWins).map((row) => row.name),
      leaderWins,
      toPlay: games.filter((game) => !game.kickedOff).length,
      you: { back: me?.back ?? null, out: Boolean(me?.out), forfeited: false, forfeitAvailable: !me?.out && moment !== "graded" },
    } : null,
  };
}
