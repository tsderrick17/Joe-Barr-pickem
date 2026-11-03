/** Players see the Season Snapshot once every Week 6 Pick'em pick has settled (see
 * season-snapshot-freshness.js), and from then on, including the playoffs. A new
 * season (Aug 1) starts with every period upcoming, so it disappears again until
 * that season's Week 6 settles. */
import { easternParts } from "./eastern-time.js";
import { activeWeekState } from "./season-snapshot-freshness.js";

const SNAPSHOT_RELEASE_WEEK = 6;
const isOpen = (period) => ["active", "complete"].includes(period.status);
const isReleaseWeek = (period) => period.period_type === "regular" && period.display_order === SNAPSHOT_RELEASE_WEEK;

/** Week 6 while it is still being played and nothing later has started: the one
 * week whose settling decides the release. Null otherwise. */
export function snapshotReleaseWeek(periods) {
  if (seasonSnapshotReleased(periods)) return null;
  return periods.find((period) => isReleaseWeek(period) && period.status === "active") ?? null;
}

/** @param releaseWeekSettled whether every Pick'em pick of an active Week 6 has settled */
export function seasonSnapshotReleased(periods, releaseWeekSettled = false) {
  return periods.some((period) => isOpen(period) && (
    period.period_type === "playoff"
    || (period.period_type === "regular" && period.display_order > SNAPSHOT_RELEASE_WEEK)
    || (isReleaseWeek(period) && (period.status === "complete" || releaseWeekSettled))));
}

/** The Eastern game days of the playoff rounds that have started, in order: [{ periodId, key, weekday, games }]. A game belongs to
 * the Eastern calendar day it kicks off on (the day the pool freezes playoff eligibility on), so a Saturday night game that ends
 * after midnight is still Saturday's; a cancelled game is no game day. `games` is every game's id, kickoff and status. */
export function playoffGameDays(periods, games) {
  const rounds = periods
    .filter((period) => period.period_type === "playoff" && isOpen(period))
    .sort((a, b) => a.display_order - b.display_order);
  return rounds.flatMap((period) => {
    const days = new Map();
    for (const game of games) {
      if (game.scoring_period_id !== period.id || ["cancelled", "no_contest"].includes(game.status)) continue;
      const when = easternParts(game.kickoff_at);
      const key = `${when.year}-${String(when.month).padStart(2, "0")}-${String(when.day).padStart(2, "0")}`;
      const day = days.get(key) ?? { periodId: period.id, key, weekday: when.weekdayShort.toUpperCase(), games: [] };
      day.games.push({ id: game.id, kickoff_at: game.kickoff_at });
      days.set(key, day);
    }
    return [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
  });
}

/** Whether a playoff game day is final: every game of it has kicked off (nobody can add a pick) and none of its picks is pending. */
function gameDayState(day, picks, now, playerIds) {
  const ids = new Set(day.games.map((game) => game.id));
  return activeWeekState({ now, games: day.games, picks: picks.filter((pick) => ids.has(pick.game_id)), playerIds });
}

/** The state of the first playoff game day that is not final yet (see season-snapshot-freshness.js), or null when every day so far is.
 * That is the next dot to appear on the playoff chart, and what decides how long the chart can be trusted. */
export function unsettledPlayoffDay({ periods, games, picks, now, playerIds }) {
  const complete = new Set(periods.filter((period) => period.status === "complete").map((period) => period.id));
  for (const day of playoffGameDays(periods, games)) {
    if (complete.has(day.periodId)) continue;
    const state = gameDayState(day, picks, now, playerIds);
    if (!state.settled) return state;
  }
  return null;
}

/** Build weekly positions. Everyone is plotted together for a week, and the
 * active week appears only once its last Pick'em pick has settled (see
 * season-snapshot-freshness.js): every player has all their picks in or every
 * game has kicked off, and no pick is pending. The playoffs are plotted one
 * Eastern game day at a time instead: a day appears once every game of it has
 * kicked off and none of its picks is pending, and nothing after a day that is
 * not final yet is drawn. A playoff round with no games on file is one point. */
export function buildSeasonSnapshot(periods, players, picks, activeWeekSettled = new Set(), games = [], now = Date.now()) {
  const playerIds = players.map((player) => player.id);
  const picksByPeriodAndPlayer = new Map();
  for (const pick of picks) {
    const key = `${pick.scoring_period_id}:${pick.player_id}`;
    const playerPicks = picksByPeriodAndPlayer.get(key) ?? [];
    playerPicks.push(pick);
    picksByPeriodAndPlayer.set(key, playerPicks);
  }
  const snapshot = { regular: [], playoffs: [] };
  const totals = new Map(playerIds.map((id) => [id, 0]));
  const ordered = periods
    .filter((period) => ["regular", "playoff"].includes(period.period_type))
    .filter((period) => ["complete", "active"].includes(period.status))
    .sort((a, b) => a.display_order - b.display_order);

  const days = playoffGameDays(periods, games);
  let waiting = false;
  for (const period of ordered) {
    if (period.period_type === "playoff" && days.some((day) => day.periodId === period.id)) {
      const roundDays = days.filter((entry) => entry.periodId === period.id);
      for (const day of roundDays) {
        if (waiting) break;
        const ids = new Set(day.games.map((game) => game.id));
        if (period.status !== "complete" && !gameDayState(day, picks, now, playerIds).settled) { waiting = true; break; }
        const scores = playerIds.map((playerId) => {
          const wins = (picksByPeriodAndPlayer.get(`${period.id}:${playerId}`) ?? []).filter((pick) => ids.has(pick.game_id) && pick.result === "win").length;
          const total = (totals.get(playerId) ?? 0) + wins;
          totals.set(playerId, total);
          return { playerId, wins: total };
        });
        snapshot.playoffs.push({ id: `${period.id}:${day.key}`, label: period.display_name, day: day.weekday, roundDays: roundDays.length, complete: true, scores });
      }
      continue;
    }
    if (waiting && period.period_type === "playoff") continue;
    const scores = [];
    for (const playerId of playerIds) {
      const playerPicks = picksByPeriodAndPlayer.get(`${period.id}:${playerId}`) ?? [];
      const graded = playerPicks.filter((pick) => pick.result === "win" || pick.result === "loss");
      if (period.status === "active" && !activeWeekSettled.has(period.id)) continue;
      const wins = graded.filter((pick) => pick.result === "win").length;
      const total = (totals.get(playerId) ?? 0) + wins;
      totals.set(playerId, total);
      scores.push({ playerId, wins: total });
    }
    if (period.status === "complete" || scores.length) {
      snapshot[period.period_type === "regular" ? "regular" : "playoffs"].push({
        id: period.id,
        label: period.display_name,
        complete: period.status === "complete",
        scores,
      });
    }
  }
  return snapshot;
}
