/**
 * The Big Board and the ticket, from the pool's own two reads (the Standings' /api/home and the Slate's /api/board).
 *
 * One shape, `BoardView`, feeds the tote board and the ticket, so the Lab (sample players) and the real clubhouse draw the very same
 * pieces. Nothing here can show more than the classic pages do: another player's pick is hidden unless the Standings sent it, and the
 * viewer's own picks come from the Slate's read of them.
 *
 * @typedef {{ hidden: boolean, team: string | null, line: string | null, result: "W" | "L" | null }} Slat
 * @typedef {{ kind: "pick", team: string, result: "W" | "L" | null } | { kind: "out" } | { kind: "owed" } | { kind: "hidden" } | { kind: "none" }} SurvivorCell
 * @typedef {{ id: string, name: string, wins: number, you: boolean, slats: Array<Slat | null>, survivor: SurvivorCell }} BoardRow
 * @typedef {{ ats: "W" | "L" | null, su: "W" | "L" | null, score: number | null, margin: number | null }} TeamResult   // score and margin (how far past the spread, negative when it missed) only once the game is final
 * @typedef {{ id: string, kickoff: string, kickedOff: boolean, action: boolean, away: string, home: string, awayLine: string, homeLine: string, results: Record<string, TeamResult> }} BoardGame   // action: a game to come, or one the pool has picks in (the Slate's Pool action)
 * @typedef {{ id: string, name: string, status: string }} BoardWeek
 * @typedef {{
 *   week: string, status: string, maxPicks: number, canPick: boolean, weekId: string | null,
 *   weeks: BoardWeek[], poolAction: boolean,   // the regular-season weeks the board can show, and the player's saved All games / Pool action choice
 *   games: BoardGame[], names: Record<string, string>, rows: BoardRow[], showSurvivor: boolean, championId: string | null, champion: string | null,
 *   mine: { picks: string[], survivor: string | null },
 *   survivor: { playing: boolean, out: boolean, outWeek: number | null, left: number, teams: Record<string, { free: boolean, usedWeek: number | null, used: boolean, locked: boolean }> },
 *   ids: Record<string, { gameId: string, teamId: string }>,
 * }} BoardView
 */
import { coverMargin, kickoffLabel, lineFor } from "./clubhouse-feed.js";

export { coverMargin };
import { selectAvailableScoringPeriods, selectDefaultScoringPeriod } from "./scoring-period.js";

const mark = (value) => (value === "W" || value === "win" ? "W" : value === "L" || value === "loss" ? "L" : null);
const STATUS = { upcoming: "UPCOMING", active: "IN PLAY", complete: "FINAL" };

/** Whether the new board and ticket cover this week. The playoffs (a pick for every game, no Survivor) still open the classic Slate. */
export function boardViewSupported(home, board) {
  return Boolean(home) && !home.isPlayoff && home.maxPicks >= 1 && home.maxPicks <= 2 && (board?.games?.length ?? 0) > 0 && Boolean(board?.bootstrap);
}

/**
 * @param {{ home: import("./api-contracts").StandingsResponse, board: import("./api-contracts").SlateResponse }} reads
 * @param {{ weekId?: string | null }} [options]  a week other than the default one: its picks come from the Slate's read of that week (every player's
 *   pick in a game that has kicked off, as the Slate shows them), and it is a look back only
 * @returns {BoardView}
 */
export function realBoardView({ home, board }, { weekId = null } = {}) {
  const now = Date.parse(board.serverTime ?? home.serverTime ?? new Date().toISOString());
  const games = [...(board.games ?? [])].sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt));
  const names = {};
  const ids = {};
  const allWeeks = board.bootstrap?.weeks ?? [];
  const defaultWeek = selectDefaultScoringPeriod(allWeeks);
  const shownWeek = (weekId && allWeeks.find((period) => period.id === weekId)) || defaultWeek;
  const lookBack = Boolean(shownWeek && defaultWeek && shownWeek.id !== defaultWeek.id);
  const finalWinner = (game, side) => {
    if (game.status !== "final" || game.awayScore === null || game.homeScore === null) return null;
    const mine = side === "away" ? game.awayScore : game.homeScore;
    const theirs = side === "away" ? game.homeScore : game.awayScore;
    return mine > theirs ? "W" : "L";   // a tie is a loss in Survivor
  };
  const finalScore = (game, side) => (game.status === "final" && game.awayScore !== null && game.homeScore !== null ? (side === "away" ? game.awayScore : game.homeScore) : null);
  const boardGames = games.map((game) => {
    names[game.awayTeamAbbreviation] = game.awayTeam;
    names[game.homeTeamAbbreviation] = game.homeTeam;
    ids[game.awayTeamAbbreviation] = { gameId: game.id, teamId: game.awayTeamId };
    ids[game.homeTeamAbbreviation] = { gameId: game.id, teamId: game.homeTeamId };
    const awayLine = lineFor(game, game.awayTeamId);
    const homeLine = lineFor(game, game.homeTeamId);
    const away = finalScore(game, "away");
    const home = finalScore(game, "home");
    return {
      id: game.id,
      kickoff: kickoffLabel(game.kickoffAt),
      kickedOff: game.status !== "scheduled" || Date.parse(game.kickoffAt) <= now,
      action: (game.status === "scheduled" && Date.parse(game.kickoffAt) > now) || (game.awayPickers?.length ?? 0) + (game.homePickers?.length ?? 0) > 0,
      away: game.awayTeamAbbreviation,
      home: game.homeTeamAbbreviation,
      awayLine,
      homeLine,
      results: {
        [game.awayTeamAbbreviation]: { ats: mark(game.awayResult), su: finalWinner(game, "away"), score: away, margin: coverMargin(away, home, awayLine) },
        [game.homeTeamAbbreviation]: { ats: mark(game.homeResult), su: finalWinner(game, "home"), score: home, margin: coverMargin(home, away, homeLine) },
      },
    };
  });
  const gameById = new Map(boardGames.map((game, index) => [game.id, { view: game, raw: games[index] }]));
  const abbreviationOf = (raw, teamId) => (teamId === raw.awayTeamId ? raw.awayTeamAbbreviation : raw.homeTeamAbbreviation);

  // The viewer's own picks, in kickoff order, as the Slate holds them.
  const myPicks = (board.myPicks ?? []).filter((pick) => gameById.has(pick.gameId))
    .map((pick) => ({ pick, ...gameById.get(pick.gameId) }))
    .sort((a, b) => boardGames.indexOf(a.view) - boardGames.indexOf(b.view));
  const mineTeams = myPicks.map(({ pick, raw }) => abbreviationOf(raw, pick.teamId));
  const mySlats = myPicks.map(({ pick, raw, view }) => {
    const team = abbreviationOf(raw, pick.teamId);
    return { hidden: false, team, line: pick.teamId === raw.awayTeamId ? view.awayLine : view.homeLine, result: view.results[team].ats };
  });

  const maxPicks = lookBack ? Math.min(2, shownWeek.max_picks ?? home.maxPicks) : home.maxPicks;
  const survivor = board.survivor;
  // The winner is called out for the week after Survivor is decided (8 days from the crowning), then the column goes; the link stays.
  const crowned = home.survivorComplete ? Date.parse(home.survivorCrownedAt ?? "") : Number.NaN;
  const fresh = Boolean(home.survivorComplete) && (Number.isNaN(crowned) || now - crowned < 8 * 86_400_000);
  const survivorShown = !lookBack && Boolean(home.survivorAvailable) && !home.isPlayoff && (!home.survivorComplete || fresh);
  const survivorRows = new Map((home.survivorRows ?? []).map((row) => [row.playerId, row]));
  const championId = fresh ? home.survivorChampionPlayerId ?? null : null;
  const mySurvivorGame = survivor?.pick ? gameById.get(survivor.pick.game_id) : null;
  const mySurvivorTeam = survivor?.pick && mySurvivorGame ? abbreviationOf(mySurvivorGame.raw, survivor.pick.selected_team_id) : null;
  const playing = !lookBack && Boolean(survivor?.available && survivor.status === "active") && !championId;
  const out = survivor?.status === "eliminated";

  // Another week: each player's picks are the ones the Slate names under each team of a game that has kicked off, and their wins are that week's.
  const slatePicks = (name) => boardGames.flatMap((view, index) => [["away", view.away, view.awayLine], ["home", view.home, view.homeLine]].flatMap(([side, team, line]) => (games[index][`${side}Pickers`] ?? []).includes(name) ? [{ hidden: false, team, line, result: view.results[team].ats }] : []));
  const sourceRows = lookBack
    ? (home.rows ?? []).map((row) => ({ ...row, picks: undefined, slate: slatePicks(row.firstName), wins: slatePicks(row.firstName).filter((pick) => pick.result === "W").length }))
    : (home.rows ?? []);
  const rows = [...sourceRows].sort((a, b) => b.wins - a.wins || a.firstName.localeCompare(b.firstName)).map((row) => {
    const you = row.id === home.viewerPlayerId;
    const base = you ? mySlats : lookBack ? row.slate : (row.picks ?? []).map((pick) => (pick.isHidden ? { hidden: true, team: null, line: null, result: null } : { hidden: false, team: pick.abbreviation ?? pick.label ?? null, line: pick.spread ?? null, result: mark(pick.resultMark) }));
    const slats = Array.from({ length: maxPicks }, (_, index) => base[index] ?? null);
    const seat = lookBack ? undefined : survivorRows.get(row.id);
    /** @type {SurvivorCell} */
    let cell = { kind: "none" };
    if (you) cell = out ? { kind: "out" } : mySurvivorTeam ? { kind: "pick", team: mySurvivorTeam, result: mySurvivorGame ? mySurvivorGame.view.results[mySurvivorTeam]?.su ?? null : null } : playing ? { kind: "owed" } : { kind: "none" };
    else if (seat) cell = seat.status === "eliminated" ? { kind: "out" } : !seat.pick ? { kind: "none" } : seat.pick.isHidden ? { kind: "hidden" } : { kind: "pick", team: seat.pick.abbreviation ?? "", result: mark(seat.pick.resultMark) };
    return { id: row.id, name: row.firstName, wins: row.wins, you, slats, survivor: cell };
  });

  const used = new Set((survivor?.usedTeamIds ?? []).filter((teamId) => teamId !== survivor?.pick?.selected_team_id));
  const teams = {};
  for (const [abbr, { gameId, teamId }] of Object.entries(ids)) {
    const locked = gameById.get(gameId).view.kickedOff;
    teams[abbr] = { free: playing && !out && !locked && !used.has(teamId), usedWeek: null, used: used.has(teamId), locked };
  }

  // The ticket opens only while the viewer has something left to do: a pick still owed, or a pick (or Survivor team) whose game has not
  // kicked off yet. Once every pick is in and locked, there is nothing to change, so the bar and the ticket go.
  const notStarted = (team) => { const ref = ids[team]; return Boolean(ref) && !gameById.get(ref.gameId).view.kickedOff; };
  const owesPick = mineTeams.length < maxPicks;
  const owesSurvivor = playing && !out && !mySurvivorTeam && Object.values(teams).some((team) => team.free);
  const changeable = owesPick || owesSurvivor || mineTeams.some(notStarted) || (playing && Boolean(mySurvivorTeam) && notStarted(mySurvivorTeam));
  const open = !lookBack && home.weekStatus !== "complete" && home.seasonPhase !== "off_season" && boardGames.some((game) => !game.kickedOff) && changeable;
  // The weeks the board can show: the regular season's, as far as the pool has opened them (the playoffs keep their own page).
  const pickable = selectAvailableScoringPeriods(allWeeks, { now, nextWeekAvailableAt: board.bootstrap?.nextWeekAvailableAt ? Date.parse(board.bootstrap.nextWeekAvailableAt) : null })
    .filter((period) => period.period_type === "regular" && period.max_picks <= 2);
  return {
    week: String(lookBack ? shownWeek.display_name : home.week ?? "").toUpperCase(),
    status: lookBack ? STATUS[shownWeek.status] ?? "" : STATUS[home.weekStatus] ?? "",
    maxPicks,
    canPick: open,
    weekId: shownWeek?.id ?? null,
    weeks: pickable.map((period) => ({ id: period.id, name: period.display_name, status: period.status })),
    poolAction: Boolean(board.showPoolAction),
    games: boardGames,
    names,
    rows,
    showSurvivor: survivorShown,
    championId,
    champion: fresh ? home.survivorChampionName ?? null : null,
    mine: { picks: mineTeams, survivor: mySurvivorTeam },
    survivor: { playing, out, outWeek: null, left: 32 - used.size, teams },
    ids,
  };
}
