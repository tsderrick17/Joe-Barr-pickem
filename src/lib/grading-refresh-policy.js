export const FAST_GRADING_REFRESH_MS = 60_000;
export const QUIET_GRADING_REFRESH_MS = 15 * 60_000;
export const KICKOFF_REFRESH_WINDOW_MS = 15 * 60_000;

/**
 * @param {{
 *   metrics: { live: number } | null;
 *   attention: unknown[];
 *   games: Array<{ state: string; kickoffAt: string }>;
 * } | null} data
 * @param {number} nowMs
 */
export function gradingRefreshInterval(data, nowMs = Date.now()) {
  if (!data) return FAST_GRADING_REFRESH_MS;
  if (data.metrics?.live || data.attention.length) return FAST_GRADING_REFRESH_MS;
  const kickoffIsNear = data.games.some((game) => {
    if (game.state !== "scheduled") return false;
    const kickoffAt = Date.parse(game.kickoffAt);
    return Number.isFinite(kickoffAt) &&
      Math.abs(kickoffAt - nowMs) <= KICKOFF_REFRESH_WINDOW_MS;
  });
  return kickoffIsNear ? FAST_GRADING_REFRESH_MS : QUIET_GRADING_REFRESH_MS;
}
