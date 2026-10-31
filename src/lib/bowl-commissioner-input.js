// @ts-check
import { easternDateTimeToUtc, easternParts } from "./eastern-time.js";

/** The largest spread the Commissioner can type for a bowl: far past any real line, so a slipped key (35 for 3.5) is caught. */
export const BOWL_MANUAL_SPREAD_MAX = 30;

/**
 * Why a hand-entered Bowl line cannot be saved, or null when it can. A pool spread always has a half point (3.5, never 3) so a pick can never tie,
 * and a game with no favorite is a pick'em at 0, the same shapes the provider feeds produce.
 * @param {{ favoriteTeamId: string | null, spread: number }} line
 * @param {{ away_team_id: string | null, home_team_id: string | null }} game
 * @returns {string | null}
 */
export function bowlManualLineProblem({ favoriteTeamId, spread }, game) {
  if (!Number.isFinite(spread)) return "Enter the spread as a number, like 3.5.";
  if (favoriteTeamId === null) return spread === 0 ? null : "A game with no favorite is a pick'em: its spread is 0.";
  if (favoriteTeamId !== game.away_team_id && favoriteTeamId !== game.home_team_id) return "The favorite must be one of the two teams in the game.";
  if (spread <= 0) return "Enter how many points the favorite gives, like 3.5.";
  if (spread > BOWL_MANUAL_SPREAD_MAX) return `A spread over ${BOWL_MANUAL_SPREAD_MAX} points is almost certainly a typing slip. Check it.`;
  if ((spread * 2) % 2 !== 1) return "A spread needs a half point, like 3.5, so no pick can tie.";
  return null;
}

/**
 * The instant for the Reschedule form's date ("2026-12-30") and time ("19:30"), both read as Eastern time like every Bowl kickoff in the pool,
 * as an ISO string; null when either is missing or not a real date and time (a 31st of February is not moved to March).
 * @param {string | null | undefined} date
 * @param {string | null | undefined} time
 */
export function easternKickoffIso(date, time) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time ?? "");
  if (!dateMatch || !timeMatch) return null;
  const [year, month, day, hour, minute] = [...dateMatch.slice(1), ...timeMatch.slice(1)].map(Number);
  if (hour > 23 || minute > 59) return null;
  const instant = easternDateTimeToUtc(year, month, day, hour, minute);
  const back = easternParts(instant);
  return back.year === year && back.month === month && back.day === day && back.hour === hour && back.minute === minute ? instant.toISOString() : null;
}
