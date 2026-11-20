import { bowlColumnName, bowlDisruptionLabel, bowlGameNote, bowlMatchupTeamLabels, bowlTeamName } from "./bowl-pool.js";
import { bowlPennant } from "./bowl-logos.js";
import { bowlPennantColors } from "./bowl-pennant.js";
import { dateFormat } from "./date-format.js";

/**
 * The Bowl ticket (the clubhouse's Bowl Pool) drawn from the Bowl Pool's own read (/api/bowl-pool), the same one the classic page and the
 * Bowl Card use, so it can never show more than they do. A pick is "favorite" or "underdog", as the classic page saves it.
 *
 * @typedef {"favorite" | "underdog"} BowlSide
 * @typedef {"owed" | "picked" | "missed" | "done" | "off"} BowlRowState
 *   owed: still open and no saved pick; picked: still open, picked; missed: kicked off with no pick (a loss); done: kicked off with a
 *   pick; off: postponed, cancelled or no contest, nothing to pick.
 * @typedef {{ side: BowlSide, teamId: string | null, name: string, line: string, score: number | null, covered: boolean | null, colors: { primary: string, secondary: string } | null }} BowlTeamCell   // colors: the school's own, once the import saved them
 * @typedef {{ id: string, bowl: string, flag: string, logo: string | null, cloth: string | null, hoist: string | null, day: string, time: string,
 *   cells: BowlTeamCell[], locked: boolean, final: boolean, note: string | null, state: BowlRowState, mine: BowlSide | null,
 *   result: "W" | "L" | null, tiebreaker: boolean, playoff: boolean }} BowlTicketGame
 * @typedef {{ kind: "pick", team: string, result: "W" | "L" | null } | { kind: "hidden" } | { kind: "none", result: "W" | "L" | null, missed?: boolean }} BowlSheetCell
 */

const EASTERN_DAY = dateFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" });
const EASTERN_TIME = dateFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
const OFF = new Set(["postponed", "cancelled", "no_contest"]);

const awayIdOf = (game) => game.away_team_id ?? game.awayTeam?.id ?? null;
const homeIdOf = (game) => game.home_team_id ?? game.homeTeam?.id ?? null;
/** The favourite's team id: the line's favourite when it is one of the two teams, else the away team (before there is a line, or a line
 * whose favourite is neither school). The two sides are therefore always the two different teams, never both the same side. */
function favoriteIdOf(game) {
  const awayId = awayIdOf(game), homeId = homeIdOf(game), lined = game.line?.favorite_team_id ?? null;
  return lined && (lined === awayId || lined === homeId) ? lined : awayId ?? homeId;
}

/** The side a team is, for a game (by its place when the team is not known yet: the away team is the favourite unless the home team is). */
function sideOf(game, teamId, place = null) {
  const favorite = favoriteIdOf(game);
  if (teamId) return teamId === favorite ? "favorite" : "underdog";
  const homeFavored = favorite !== null && favorite === homeIdOf(game);
  return (place === "home") === homeFavored ? "favorite" : "underdog";
}

/** The team a side is, for a game. */
export function bowlTeamForSide(game, side) {
  const awayId = awayIdOf(game);
  const homeId = homeIdOf(game);
  const favorite = favoriteIdOf(game);
  const id = side === "favorite" ? favorite : favorite === awayId ? homeId : awayId;
  return { id, team: id === awayId ? game.awayTeam : game.homeTeam };
}

/** The line as a pick of `side` reads it: "-3.5" for the favourite, "+3.5" for the underdog, "—" before the line is set. */
function lineFor(game, side) {
  const raw = game.line?.locked_spread;
  if (raw === null || raw === undefined || raw === "") return "—";
  const value = Math.abs(Number(raw));
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "PK";
  return `${side === "favorite" ? "-" : "+"}${value}`;
}

/** The viewer's saved picks, by game: the picks themselves, then any placeholder picks made before a game had its teams and line. */
export function bowlSavedPicks(payload) {
  const games = payload?.games ?? [];
  /** @type {Record<string, BowlSide>} */
  const saved = {};
  for (const pick of payload?.ownPreviewSelections ?? []) if (pick?.game_id && (pick.side === "favorite" || pick.side === "underdog")) saved[pick.game_id] = pick.side;
  for (const pick of payload?.ownPicks ?? []) {
    const game = games.find((candidate) => candidate.id === pick.game_id);
    if (game) saved[pick.game_id] = sideOf(game, pick.selected_team_id);
  }
  return saved;
}

/**
 * @param {any} payload  the Bowl Pool's read
 * @param {{ now?: number, viewerPlayerId?: string | null }} [options]
 */
export function bowlTicketView(payload, { now = Date.now(), viewerPlayerId = null } = {}) {
  const saved = bowlSavedPicks(payload);
  const championshipId = payload?.season?.championship_game_id ?? null;
  const ownResults = new Map((payload?.ownPicks ?? []).map((pick) => [pick.game_id, pick.result]));
  /** @type {BowlTicketGame[]} */
  const games = (payload?.games ?? []).map((game) => {
    const kickoff = game.kickoff_at ? Date.parse(game.kickoff_at) : NaN;
    const off = OFF.has(game.status ?? "");
    const locked = off || (Number.isFinite(kickoff) && now >= kickoff);
    const final = game.status === "final" && Number.isInteger(game.away_score) && Number.isInteger(game.home_score);
    const pennant = bowlPennant(game.bowl_name);
    const cell = (team, teamId, score, place) => {
      const side = sideOf(game, teamId, place);
      let covered = null;
      if (final && game.line?.locked_spread != null && teamId) {
        const other = teamId === game.away_team_id ? game.home_score : game.away_score;
        const spread = Math.abs(Number(game.line.locked_spread));
        covered = side === "favorite" ? score - other > spread : score + spread > other;
      }
      const colors = team?.primary_color ? (({ primary, secondary }) => ({ primary, secondary }))(bowlPennantColors(team)) : null;
      return { side, teamId: teamId ?? null, name: bowlTeamName(team), line: lineFor(game, side), score: final ? score : null, covered, colors };
    };
    const mine = saved[game.id] ?? null;
    const result = ownResults.get(game.id) === "win" ? "W" : ownResults.get(game.id) === "loss" ? "L" : null;
    /** @type {BowlRowState} */
    const state = off ? "off" : locked ? (mine ? "done" : "missed") : mine ? "picked" : "owed";
    return {
      id: game.id,
      bowl: (game.bowl_name || "Bowl game").replace(/\s+presented by .*$/i, ""),
      ...pennant,
      day: Number.isFinite(kickoff) ? EASTERN_DAY.format(new Date(kickoff)).toUpperCase().replace(",", "") : "DATE TBD",
      time: Number.isFinite(kickoff) && game.time_confirmed !== false ? EASTERN_TIME.format(new Date(kickoff)) : "Time TBD",
      cells: [cell(game.awayTeam, game.away_team_id ?? game.awayTeam?.id, game.away_score, "away"), cell(game.homeTeam, game.home_team_id ?? game.homeTeam?.id, game.home_score, "home")],
      locked,
      final,
      note: bowlDisruptionLabel(game.status) ?? bowlGameNote(game, new Date(now)) ?? null,
      state,
      mine,
      result: result ?? (state === "missed" && final ? "L" : null),
      tiebreaker: game.id === championshipId,
      playoff: /cfp|playoff|first round|quarterfinal|semifinal/i.test(game.bowl_name ?? ""),
    };
  });
  const decided = games.filter((game) => game.final || game.state === "off").length;
  const standings = (payload?.standings ?? []).map((row) => ({ id: row.playerId, name: row.playerName, wins: row.wins ?? 0, losses: row.losses ?? 0, you: row.playerId === viewerPlayerId }));
  const ranked = standings.map((row) => {
    const place = standings.findIndex((other) => other.wins === row.wins) + 1;
    return { ...row, place, tied: standings.filter((other) => other.wins === row.wins).length > 1 };
  });
  const guess = payload?.entry?.championship_total_guess;
  return {
    sheet: bowlSheet(payload, games, ranked, now, viewerPlayerId),
    optedIn: Boolean(payload?.optedIn),
    entryOpen: Boolean(payload?.entryOpen),
    games,
    saved,
    guess: guess === null || guess === undefined ? "" : String(guess),
    tiebreakerLocked: games.some((game) => game.tiebreaker && game.locked),
    total: games.length,
    decided,
    owed: games.filter((game) => game.state === "owed").length,
    picked: games.filter((game) => game.state === "picked").length,   // still to play and already picked: with the picks owed, the bowls left
    standings: ranked,
  };
}

/**
 * The whole Bowl Pool on one sheet, as the Standings page's Bowl Card has it: a row per player in standings order, a column per bowl. A
 * bowl that has kicked off shows the school each player took, in the result's colour (green won, red lost, amber not yet final); before
 * kickoff another player's pick is never shown: a lit lamp says one is in, an unlit lamp that there is none yet. Your own row shows your
 * own picks all along. It reads only what the Bowl Pool's read already gives (picks after kickoff, markers before).
 * @param {any} payload
 * @param {BowlTicketGame[]} games
 * @param {Array<{ id: string, name: string, wins: number, losses: number, you: boolean, place: number, tied: boolean }>} standings
 * @param {number} now
 * @param {string | null} viewerPlayerId
 * @returns {{ games: Array<{ id: string, name: string, day: string, locked: boolean }>, todayIndex: number, rows: Array<{ id: string, name: string, wins: number, losses: number, place: number, tied: boolean, you: boolean, cells: BowlSheetCell[] }> }}
 */
function bowlSheet(payload, games, standings, now, viewerPlayerId) {
  const raw = new Map((payload?.games ?? []).map((game) => [game.id, game]));
  // Each school by its short abbreviation (ESPN's), or the Bowl Card's name for it when it has none.
  const teamLabel = (gameId, teamId) => {
    const game = raw.get(gameId);
    if (!game || !teamId) return "?";
    const away = teamId === (game.away_team_id ?? game.awayTeam?.id);
    const team = away ? game.awayTeam : game.homeTeam;
    if (team?.abbreviation) return team.abbreviation;
    const [awayLabel, homeLabel] = bowlMatchupTeamLabels(game.awayTeam, game.homeTeam);
    return away ? awayLabel : homeLabel;
  };
  const shown = new Map((payload?.publicPicks ?? []).map((pick) => [`${pick.playerId}:${pick.game_id}`, pick]));
  const markers = new Set((payload?.privatePickMarkers ?? []).map((pick) => `${pick.playerId}:${pick.game_id}`));
  const automatic = new Map((payload?.automaticResults ?? []).map((result) => [`${result.playerId}:${result.game_id}`, result.result]));
  const mine = new Map((payload?.ownPicks ?? []).map((pick) => [pick.game_id, pick]));
  const today = EASTERN_DAY.format(new Date(now)).toUpperCase().replace(",", "");
  /** @type {(result: string | null | undefined) => "W" | "L" | null} */
  const mark = (result) => (result === "win" ? "W" : result === "loss" ? "L" : null);
  return {
    games: games.map((game) => ({ id: game.id, name: bowlColumnName(raw.get(game.id) ?? {}), day: game.day, locked: game.locked })),
    todayIndex: games.findIndex((game) => game.day === today),
    rows: standings.map((row) => ({
      id: row.id, name: row.name, wins: row.wins, losses: row.losses, place: row.place, tied: row.tied, you: row.id === viewerPlayerId,
      cells: games.map((game) => /** @returns {BowlSheetCell} */ {
        const key = `${row.id}:${game.id}`;
        const own = row.id === viewerPlayerId ? mine.get(game.id) : null;
        const pick = own ? { selected_team_id: own.selected_team_id, result: own.result } : shown.get(key);
        if (pick) return { kind: "pick", team: teamLabel(game.id, pick.selected_team_id), result: mark(pick.result) };
        if (automatic.has(key)) return { kind: "none", result: mark(automatic.get(key)) };
        if (!game.locked && markers.has(key)) return { kind: "hidden" };
        // kicked off with no pick: a miss (a loss once graded); before kickoff, simply none yet
        return { kind: "none", result: game.locked && row.id === viewerPlayerId && game.state === "missed" ? "L" : null, missed: game.locked };
      }),
    })),
  };
}
