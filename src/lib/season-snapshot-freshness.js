import { FIRST_SCORE_CHECK_DELAY_MINUTES } from "./score-window.js";

/**
 * When is the active week "settled", and how long can a chart be trusted?
 *
 * The chart plots the active week for everyone at once, as soon as its last
 * Pick'em pick has settled. That is usually before the final game of the week
 * (often Monday night) because nobody has to have picked it. A week is settled
 * when every active player is finished picking and every pick is graded:
 *  - a player is finished picking when all their picks are in (they hold the
 *    full number for the week) or every game of the week has kicked off, and
 *  - nobody has a pick still pending.
 * A player who has not used all their picks keeps the week open until the last
 * kickoff, because they could still add one. That is the cautious direction:
 * the chart never plots a week that could still change.
 */
export const HOLD_MS = 60 * 60 * 1000;
export const WAITING_FOR_GRADES_MS = 2 * 60 * 1000;
export const CLOSED_CHART_MS = 5 * 60 * 1000;
const FINAL_DELAY_MS = FIRST_SCORE_CHECK_DELAY_MINUTES * 60 * 1000;

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/**
 * @param {{ now: number, maxPicks?: number | null, games: Array<{ id: string, kickoff_at: string }>, picks: Array<{ player_id: string, game_id: string, result: string }>, playerIds: string[] }} week
 */
export function activeWeekState({ now, maxPicks, games, picks, playerIds }) {
  const kickoffs = new Map(games.map((game) => [game.id, new Date(game.kickoff_at).getTime()]));
  const lastKickoff = Math.max(...kickoffs.values(), Number.NEGATIVE_INFINITY);
  const allKickedOff = games.length > 0 && lastKickoff <= now;
  const pending = picks.filter((pick) => pick.result === "pending");
  const live = picks.filter((pick) => pick.result !== "void");
  const finishedPicking = playerIds.every((playerId) => {
    if (allKickedOff) return true;
    const count = live.filter((pick) => pick.player_id === playerId).length;
    return Number.isFinite(maxPicks) && maxPicks > 0 && count >= maxPicks;
  });
  const settled = games.length > 0 && pending.length === 0 && finishedPicking;
  const pendingKickoffs = pending.map((pick) => kickoffs.get(pick.game_id)).filter((value) => Number.isFinite(value));
  return {
    settled,
    lastKickoff: Number.isFinite(lastKickoff) ? lastKickoff : null,
    // The earliest a pending pick's game could be graded: results are first
    // checked about three hours after kickoff.
    earliestGrade: pendingKickoffs.length ? Math.max(...pendingKickoffs) + FINAL_DELAY_MS : null,
  };
}

/**
 * How long a chart built at `now` can be trusted before it could have changed.
 * @param {number} now
 * @param {Array<ReturnType<typeof activeWeekState>>} weeks the active weeks (usually one)
 */
export function snapshotFreshForMs(now, weeks) {
  if (!weeks.length || weeks.every((week) => week.settled)) return HOLD_MS;
  const waiting = weeks.filter((week) => !week.settled);
  // Pending picks cannot be graded before their games are checked, so there is
  // nothing to look for until then.
  const grades = waiting.map((week) => week.earliestGrade).filter((value) => value !== null);
  if (grades.length) {
    const earliest = Math.max(...grades);
    return now < earliest ? clamp(earliest - now, WAITING_FOR_GRADES_MS, HOLD_MS) : WAITING_FOR_GRADES_MS;
  }
  // Nothing is pending, but a player could still add a pick until the last kickoff.
  const lasts = waiting.map((week) => week.lastKickoff).filter((value) => value !== null);
  if (!lasts.length) return WAITING_FOR_GRADES_MS;
  const last = Math.max(...lasts);
  return now < last ? clamp(last - now, WAITING_FOR_GRADES_MS, HOLD_MS) : WAITING_FOR_GRADES_MS;
}
