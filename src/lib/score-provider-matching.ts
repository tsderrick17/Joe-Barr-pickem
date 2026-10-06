type ProviderScore = { name: string; score: string | number | null };
export type ProviderScoreEvent = {
  id: string;
  completed: boolean;
  scores?: ProviderScore[];
};
type MatchableGame = {
  id: string;
  odds_event_id: string | null;
  away_team_id: string;
  home_team_id: string;
};
type ProviderTeam = { id: string; full_name: string };

function parseScore(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  return Number(value);
}

/**
 * Match only completed provider events belonging to games due for checking,
 * then accept a final only when both stored teams have valid integer scores.
 * A completed-but-unmatchable event is counted for the caller to fail closed.
 */
export function matchProviderFinalScores<Game extends MatchableGame>(
  dueGames: readonly Game[],
  completedEvents: readonly ProviderScoreEvent[],
  teams: readonly ProviderTeam[],
) {
  const eventByExternalId = new Map(completedEvents.map((event) => [event.id, event]));
  const savedGames = dueGames.filter(
    (game) => Boolean(game.odds_event_id && eventByExternalId.has(game.odds_event_id)),
  );
  const teamIdByName = new Map(teams.map((team) => [team.full_name, team.id]));
  const finalizedGames: Array<Game & { awayScore: number; homeScore: number }> = [];

  for (const game of savedGames) {
    const scores = game.odds_event_id
      ? eventByExternalId.get(game.odds_event_id)?.scores ?? []
      : [];
    const scoreByTeamId = new Map(
      scores.map((score) => [teamIdByName.get(score.name), parseScore(score.score)]),
    );
    const awayScore = scoreByTeamId.get(game.away_team_id);
    const homeScore = scoreByTeamId.get(game.home_team_id);

    if (awayScore === null || awayScore === undefined || homeScore === null || homeScore === undefined) continue;
    finalizedGames.push({ ...game, awayScore, homeScore });
  }

  return {
    completedEvents,
    finalizedGames,
    unmatchedCompletedGames: completedEvents.length - finalizedGames.length,
  };
}

export function selectCompletedProviderEvents<Game extends Pick<MatchableGame, "odds_event_id">>(
  dueGames: readonly Game[],
  providerEvents: readonly ProviderScoreEvent[],
) {
  const dueGameIds = new Set(dueGames.flatMap((game) => game.odds_event_id ? [game.odds_event_id] : []));
  return providerEvents.filter(
    (event) => dueGameIds.has(event.id) && event.completed && event.scores?.length === 2,
  );
}
