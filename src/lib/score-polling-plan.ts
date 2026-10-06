export type ScorePollingMode = "regular" | "playoff";

export type ScoreCheckBackoff = {
  game_id: string;
  attempts: number;
  next_check_at: string;
};

type DueScoreGame = {
  id: string;
  scoring_period_id: string;
};

/** Select the score checks that may spend a provider call on this run. */
export function selectEligibleScoreGames<Game extends DueScoreGame>({
  dueGames,
  backoffs,
  playoffPeriodIds,
  now,
  bypassProviderCooldown = false,
}: {
  dueGames: readonly Game[];
  backoffs: readonly ScoreCheckBackoff[];
  playoffPeriodIds: ReadonlySet<string>;
  now: Date;
  bypassProviderCooldown?: boolean;
}): {
  backoffByGameId: Map<string, ScoreCheckBackoff>;
  eligibleGames: Game[];
  pollingMode: ScorePollingMode;
} {
  const backoffByGameId = new Map(backoffs.map((row) => [row.game_id, row]));
  const eligibleGames = dueGames.filter((game) => {
    const nextCheckAt = backoffByGameId.get(game.id)?.next_check_at;
    return bypassProviderCooldown || !nextCheckAt || new Date(nextCheckAt).getTime() <= now.getTime();
  });

  return {
    backoffByGameId,
    eligibleGames,
    pollingMode: eligibleGames.some((game) => playoffPeriodIds.has(game.scoring_period_id))
      ? "playoff"
      : "regular",
  };
}
