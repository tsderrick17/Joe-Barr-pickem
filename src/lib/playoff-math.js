function easternDay(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

/**
 * Playoff eligibility is deliberately measured from the start of the current
 * Eastern game day. That prevents a player from being locked out midway
 * through a slate that was still capable of tying the lead that morning.
 */
export function calculatePlayoffEligibility({ players, periods, games, picks, targetPeriodId, now = new Date() }) {
  const target = periods.find((period) => period.id === targetPeriodId);
  const applies = target?.period_type === "playoff" && target.status === "active";
  if (!applies) return { applies: false, eliminatedPlayerIds: new Set(), leaderWinsAtDayStart: 0, remainingPossibleWins: 0 };

  const day = easternDay(now);
  const gameById = new Map(games.map((game) => [game.id, game]));
  const playoffPeriods = periods.filter((period) => period.period_type === "playoff" && period.display_order >= target.display_order);
  const winsAtDayStart = new Map(players.map((player) => [player.id, 0]));

  for (const pick of picks) {
    const game = gameById.get(pick.game_id);
    if (pick.result !== "win" || !game || easternDay(game.kickoff_at) >= day) continue;
    winsAtDayStart.set(pick.player_id, (winsAtDayStart.get(pick.player_id) ?? 0) + 1);
  }

  const leaderWinsAtDayStart = Math.max(0, ...players.map((player) => winsAtDayStart.get(player.id) ?? 0));
  const remainingPossibleWins = playoffPeriods.reduce((total, period) => {
    if (period.status === "complete") return total;
    const periodGames = games.filter((game) => game.scoring_period_id === period.id && !["cancelled", "postponed"].includes(game.status));
    if (period.id === target.id) {
      return total + periodGames.filter((game) => easternDay(game.kickoff_at) >= day).length;
    }
    return total + Math.max(periodGames.length, period.max_picks);
  }, 0);

  return {
    applies: true,
    leaderWinsAtDayStart,
    remainingPossibleWins,
    eliminatedPlayerIds: new Set(players.filter((player) => (winsAtDayStart.get(player.id) ?? 0) + remainingPossibleWins < leaderWinsAtDayStart).map((player) => player.id)),
  };
}
