import { bowlDisruptionLabel, bowlGameNote, bowlTeamName } from "./bowl-pool.js";
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
 *   result: "W" | "L" | null, tiebreaker: boolean }} BowlTicketGame
 */

const EASTERN_DAY = dateFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" });
const EASTERN_TIME = dateFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
const OFF = new Set(["postponed", "cancelled", "no_contest"]);

/** The side a team id is, for a game: the favourite is the line's favourite (the away team before there is a line). */
function sideOf(game, teamId) {
  const favorite = game.line?.favorite_team_id ?? game.away_team_id ?? game.awayTeam?.id ?? null;
  return teamId === favorite ? "favorite" : "underdog";
}

/** The team a side is, for a game. */
export function bowlTeamForSide(game, side) {
  const awayId = game.away_team_id ?? game.awayTeam?.id ?? null;
  const homeId = game.home_team_id ?? game.homeTeam?.id ?? null;
  const favorite = game.line?.favorite_team_id ?? awayId;
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
    const cell = (team, teamId, score) => {
      const side = sideOf(game, teamId);
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
      cells: [cell(game.awayTeam, game.away_team_id ?? game.awayTeam?.id, game.away_score), cell(game.homeTeam, game.home_team_id ?? game.homeTeam?.id, game.home_score)],
      locked,
      final,
      note: bowlDisruptionLabel(game.status) ?? bowlGameNote(game, new Date(now)) ?? null,
      state,
      mine,
      result: result ?? (state === "missed" && final ? "L" : null),
      tiebreaker: game.id === championshipId,
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
    optedIn: Boolean(payload?.optedIn),
    entryOpen: Boolean(payload?.entryOpen),
    games,
    saved,
    guess: guess === null || guess === undefined ? "" : String(guess),
    tiebreakerLocked: games.some((game) => game.tiebreaker && game.locked),
    total: games.length,
    decided,
    owed: games.filter((game) => game.state === "owed").length,
    standings: ranked,
  };
}
