import {
  DISRUPTED_GAME_STATUSES,
  isSettledGameStatus,
} from "./game-status-policy.js";

export function isTerminalGameStatus(status) {
  return isSettledGameStatus(status);
}

export function isFreshSlateReady({ activePeriod, gameCount }) {
  if (!activePeriod) return { ready: false, reason: "The new week is not active yet." };
  return gameCount > 1
    ? { ready: true, reason: null }
    : { ready: false, reason: "The new week does not yet have a full Slate." };
}

export function isPlayoffDayRecapReady({ period, games, pendingAtsCount, now, easternDay }) {
  if (!period) return { ready: false, reason: "A playoff round is not active yet." };
  const started = games.filter((game) => new Date(game.kickoff_at) <= now);
  if (!started.length) return { ready: false, reason: "No playoff games have started yet." };
  const latestDay = started.reduce((latest, game) => easternDay(game.kickoff_at) > latest ? easternDay(game.kickoff_at) : latest, easternDay(started[0].kickoff_at));
  const dayGames = started.filter((game) => easternDay(game.kickoff_at) === latestDay);
  if (dayGames.some((game) => !isTerminalGameStatus(game.status))) return { ready: false, reason: "The latest playoff day is still in progress." };
  return pendingAtsCount === 0 ? { ready: true, reason: null } : { ready: false, reason: "Playoff grades are still being finalized." };
}

export function isSundayWindowReady({ activePeriod, games, window, now, easternWeekday, easternHour }) {
  if (!activePeriod) return { ready: false, reason: "There is no active week for the Sunday reveal." };
  const [startHour, endHour] = window === "early" ? [12, 16] : [16, 20];
  const gamesInWindow = games.filter((game) => easternWeekday(game.kickoff_at) === "Sunday" && easternHour(game.kickoff_at) >= startHour && easternHour(game.kickoff_at) < endHour && !DISRUPTED_GAME_STATUSES.has(game.status));
  if (!gamesInWindow.length) return { ready: false, reason: "There are no games in this Sunday kickoff window." };
  if (gamesInWindow.some((game) => new Date(game.kickoff_at) > now)) return { ready: false, reason: "The selected Sunday games have not all reached kickoff yet." };
  return { ready: true, reason: null };
}

export function publicRevealSelectionReadiness({ kickoffReady, selectedPickCount }) {
  if (!kickoffReady.ready) return kickoffReady;
  if (selectedPickCount > 0) return { ready: true, reason: null };
  return {
    ready: false,
    terminal: true,
    reason: "No player selected a game in this public-pick window.",
  };
}

export function finalLinesSelectionReadiness({ slateReady, eligiblePlayerCount }) {
  if (!slateReady.ready) return slateReady;
  if (eligiblePlayerCount === 0) {
    return {
      ready: false,
      terminal: true,
      reason: "No player can still make a Pick'em selection for these games.",
    };
  }
  return { ready: true, reason: null };
}
