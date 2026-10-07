import type { GameStatus } from "@/lib/db-statuses";
import { isDueForFinalScoreCheck } from "@/lib/score-window";
import { scorePollingMode, shouldHoldScorePollingForQuota, type ScorePollingMode } from "@/lib/score-check-backoff";

/**
 * The score worker's decisions, kept apart from its reads and writes: which games are due for a score check, which
 * of those may be asked about now, which cadence applies, and whether the paid provider's remaining allowance says
 * to hold off. Pure functions of what the worker already read (no database, no clock of their own), so each can be
 * exercised with a plain scenario. The worker reads context, asks these, then acts.
 */
export type PlannedGame = { id: string; scoring_period_id: string; kickoff_at: string; status: GameStatus };
export type PlannedBackoff = { game_id: string; attempts: number; next_check_at: string };
export type ProviderRun = { details: unknown; completed_at: string | null; started_at: string | null };

/** Games that have kicked off and are not final, and have waited long enough to be worth asking about. */
export function selectDueGames<T extends PlannedGame>(unfinishedGames: T[], now: Date): T[] {
  return unfinishedGames.filter((game) => isDueForFinalScoreCheck({ kickoffAt: game.kickoff_at, status: game.status }, now));
}

/** Due games whose own retry timer has passed (a Commissioner recovery run may bypass the timers). */
export function selectEligibleGames<T extends PlannedGame>(dueGames: T[], backoffByGameId: Map<string, PlannedBackoff>, now: Date, bypassProviderCooldown: boolean): T[] {
  return dueGames.filter((game) => {
    const nextCheckAt = backoffByGameId.get(game.id)?.next_check_at;
    return bypassProviderCooldown || !nextCheckAt || new Date(nextCheckAt).getTime() <= now.getTime();
  });
}

/** The polling cadence: faster while any eligible game belongs to a playoff round. */
export function pollingModeFor(eligibleGames: PlannedGame[], playoffPeriodIds: Set<string>): ScorePollingMode {
  return scorePollingMode(eligibleGames.some((game) => playoffPeriodIds.has(game.scoring_period_id)));
}

export function parseCreditHeader(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
}

/**
 * Whether to skip the paid provider this run. Only when every eligible game has already been retried at least
 * twice (a delayed final, not a fresh one) and the most recently reported allowance is low and recent.
 */
export function decideQuotaHold({ eligibleGames, backoffByGameId, recentProviderRuns, now }: {
  eligibleGames: PlannedGame[];
  backoffByGameId: Map<string, PlannedBackoff>;
  recentProviderRuns: ProviderRun[];
  now: Date;
}): { hold: boolean; creditsRemaining: number | null } {
  const latestAllowanceRun = recentProviderRuns.find((providerRun) => {
    const details = providerRun.details as { requestsRemaining?: unknown } | null;
    return parseCreditHeader(details?.requestsRemaining) !== null;
  }) ?? null;
  const details = latestAllowanceRun?.details as { requestsRemaining?: unknown } | null;
  const creditsRemaining = parseCreditHeader(details?.requestsRemaining);
  const observedAt = latestAllowanceRun?.completed_at ?? latestAllowanceRun?.started_at ?? null;
  const onlyRepeatedDelayedGames = eligibleGames.every((game) => (backoffByGameId.get(game.id)?.attempts ?? 0) >= 2);
  const hold = eligibleGames.length > 0 && onlyRepeatedDelayedGames && shouldHoldScorePollingForQuota(creditsRemaining, observedAt, now);
  return { hold, creditsRemaining };
}
