import {
  advanceScoringPeriods,
  type WeekRolloverResult,
} from "@/lib/advance-scoring-periods";
import { isDueForFinalScoreCheck } from "@/lib/score-window";
import {
  buildDeferredScoreCheckRows,
  shouldProtectScoreProviderQuota,
} from "@/lib/score-check-backoff";
import {
  selectEligibleScoreGames,
  type ScoreCheckBackoff,
  type ScorePollingMode,
} from "@/lib/score-polling-plan";
import {
  fetchScoreProviderEvents,
  ScoreProviderClientError,
} from "@/lib/score-provider-client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishSyncRun } from "@/lib/sync-run";
import { voidDisruptedPicks } from "@/lib/void-disrupted-picks";
import { eliminateSurvivorNoPicks } from "@/lib/eliminate-survivor-no-picks";
import { ensureAnnualSeasonRollover } from "@/lib/season-rollover";
import {
  matchProviderFinalScores,
  selectCompletedProviderEvents,
} from "@/lib/score-provider-matching";

type GameRow = {
  id: string;
  external_game_id: string;
  odds_event_id: string | null;
  scoring_period_id: string;
  away_team_id: string;
  home_team_id: string;
  kickoff_at: string;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled" | "no_contest";
};
type FinalGameRow = GameRow & { awayScore: number; homeScore: number };
export type ScoreSyncResult = {
  checkedAt: string;
  eligibleGames: number;
  providerChecked: boolean;
  completedGamesFound: number;
  finalScoresImported: number;
  newFinals?: number;
  newFinalsByRung?: Record<string, number>;
  ladderRungs?: Record<string, number>;
  picksGraded: number;
  picksAwaitingLine: number;
  requestsRemaining: string | null;
  requestsUsed: string | null;
  requestsLast: string | null;
  pollingMode: ScorePollingMode | "idle";
  warnings: string[];
  weekRollover: WeekRolloverResult;
  survivorNoPickEliminations: number;
  quotaProtected?: boolean;
};

async function deferUnfinishedScoreChecks(
  games: GameRow[],
  previousChecks: Map<string, ScoreCheckBackoff>,
  checkedAt: string,
  playoffPeriodIds: Set<string>,
) {
  if (games.length === 0) return;

  const rows = buildDeferredScoreCheckRows({
    games,
    previousChecks,
    checkedAt,
    playoffPeriodIds,
  });
  const { error } = await supabaseAdmin
    .from("score_check_backoff")
    .upsert(rows, { onConflict: "game_id" });
  if (error) throw new Error("Delayed score checks could not be rescheduled safely.");
}

function parseCreditHeader(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
}

async function recoverPendingFinalPickGrades() {
  // One database call grades every pending pick on a verified final together,
  // so an interruption can never leave a week half-graded.
  const { data, error } = await supabaseAdmin.rpc("recover_pending_ats_grades");
  const row = (data as Array<{ picks_graded: number; picks_awaiting_line: number }> | null)?.[0];

  if (error || !row) {
    throw new Error("Pending final pick grades could not be recovered safely.");
  }

  return {
    picksGraded: row.picks_graded,
    picksAwaitingLine: row.picks_awaiting_line,
  };
}

async function snapshotActivePlayoffEligibility() {
  const { data: activePlayoffPeriods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id")
    .eq("period_type", "playoff")
    .eq("status", "active");
  if (periodsError) throw new Error("Active playoff eligibility could not be prepared.");

  const results = await Promise.all(
    (activePlayoffPeriods ?? []).map((period) =>
      supabaseAdmin.rpc("snapshot_playoff_day_eligibility", {
        target_scoring_period_id: period.id,
      }),
    ),
  );
  if (results.some((result) => result.error)) {
    throw new Error("Active playoff eligibility could not be snapshotted safely.");
  }
}

export async function syncFinalScores({
  bypassProviderCooldown = false,
  signal,
}: {
  bypassProviderCooldown?: boolean;
  signal?: AbortSignal;
} = {}): Promise<ScoreSyncResult> {
  signal?.throwIfAborted();
  const oddsApiKey = process.env.ODDS_API_KEY;

  if (!oddsApiKey) {
    throw new Error("The Odds API key is not configured.");
  }

  const checkedAt = new Date().toISOString();
  const now = new Date(checkedAt);
  const warnings: string[] = [];
  await ensureAnnualSeasonRollover(checkedAt, signal);
  signal?.throwIfAborted();
  await voidDisruptedPicks();
  signal?.throwIfAborted();
  const { error: noContestError } = await supabaseAdmin.rpc("settle_no_contest_picks", {
    evaluated_at: checkedAt,
  });
  signal?.throwIfAborted();
  if (noContestError) {
    throw new Error("Declared no-contest picks could not be settled safely.");
  }
  const noPickResult = await eliminateSurvivorNoPicks(checkedAt);
  signal?.throwIfAborted();
  const recoveredGrades = await recoverPendingFinalPickGrades();
  signal?.throwIfAborted();
  const weekRollover = await advanceScoringPeriods(now);
  signal?.throwIfAborted();
  await snapshotActivePlayoffEligibility();
  signal?.throwIfAborted();
  const providerLookbackStart = new Date(
    now.getTime() - 3 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: unfinishedGames, error: unfinishedGamesError } =
    await supabaseAdmin
      .from("games")
      .select(
        "id, external_game_id, odds_event_id, scoring_period_id, away_team_id, home_team_id, kickoff_at, status",
      )
      .in("status", ["scheduled", "live"])
      .lte("kickoff_at", checkedAt)
      .gte("kickoff_at", providerLookbackStart);
  signal?.throwIfAborted();

  if (unfinishedGamesError || !unfinishedGames) {
    throw new Error("Games awaiting final scores could not be loaded.");
  }

  const scoreDueGames = (unfinishedGames as GameRow[]).filter((game) =>
    isDueForFinalScoreCheck({ kickoffAt: game.kickoff_at, status: game.status }, now),
  );
  const scorePeriodIds = [...new Set(scoreDueGames.map((game) => game.scoring_period_id))];
  const { data: scorePeriods, error: scorePeriodsError } = scorePeriodIds.length
    ? await supabaseAdmin
        .from("scoring_periods")
        .select("id, period_type")
        .in("id", scorePeriodIds)
    : { data: [], error: null };
  signal?.throwIfAborted();
  if (scorePeriodsError) {
    throw new Error("Score polling cadence could not be determined safely.");
  }
  const playoffPeriodIds = new Set(
    (scorePeriods ?? [])
      .filter((period) => period.period_type === "playoff")
      .map((period) => period.id),
  );
  const { data: scoreCheckBackoffs, error: scoreCheckBackoffsError } =
    scoreDueGames.length
      ? await supabaseAdmin
          .from("score_check_backoff")
          .select("game_id, attempts, next_check_at")
          .in("game_id", scoreDueGames.map((game) => game.id))
      : { data: [], error: null };
  signal?.throwIfAborted();
  if (scoreCheckBackoffsError) {
    throw new Error("Delayed score checks could not be loaded safely.");
  }
  const { backoffByGameId, eligibleGames, pollingMode } = selectEligibleScoreGames({
    dueGames: scoreDueGames,
    backoffs: (scoreCheckBackoffs ?? []) as ScoreCheckBackoff[],
    playoffPeriodIds,
    now,
    bypassProviderCooldown,
  });

  // Every outcome reports the same fields; only what actually differs is passed in.
  const buildResult = (overrides: Partial<ScoreSyncResult> = {}): ScoreSyncResult => ({
    checkedAt,
    eligibleGames: 0,
    providerChecked: false,
    completedGamesFound: 0,
    finalScoresImported: 0,
    newFinals: 0,
    newFinalsByRung: {},
    picksGraded: recoveredGrades.picksGraded,
    picksAwaitingLine: recoveredGrades.picksAwaitingLine,
    requestsRemaining: null,
    requestsUsed: null,
    requestsLast: null,
    pollingMode: "idle",
    warnings,
    weekRollover,
    survivorNoPickEliminations: noPickResult.entries_eliminated,
    ...overrides,
  });
  const noScoreResult = buildResult();
  const shouldRecordRollover =
    weekRollover.action === "activated" ||
    weekRollover.action === "completed" ||
    recoveredGrades.picksGraded > 0;

  if (eligibleGames.length === 0 && !shouldRecordRollover) {
    return noScoreResult;
  }

  const { data: recentProviderRuns, error: recentProviderRunsError } =
    await supabaseAdmin
      .from("sync_runs")
      .select("details, completed_at, started_at")
      .eq("provider", "The Odds API")
      .in("status", ["success", "failed"])
      .order("started_at", { ascending: false })
      .limit(25);
  signal?.throwIfAborted();
  if (recentProviderRunsError) {
    throw new Error("Recent score-provider usage could not be loaded.");
  }
  const latestAllowanceRun = (recentProviderRuns ?? []).find((providerRun) => {
    const details = providerRun.details as { requestsRemaining?: unknown } | null;
    return parseCreditHeader(details?.requestsRemaining) !== null;
  }) ?? null;
  const latestAllowanceDetails = latestAllowanceRun?.details as { requestsRemaining?: unknown } | null;
  const lastRemaining = parseCreditHeader(latestAllowanceDetails?.requestsRemaining);
  const lastObservedAt = latestAllowanceRun?.completed_at ?? latestAllowanceRun?.started_at ?? null;
  if (
    shouldProtectScoreProviderQuota(
      eligibleGames,
      backoffByGameId,
      lastRemaining,
      lastObservedAt,
      now,
    )
  ) {
    warnings.push(
      `Score polling is conserving the remaining Odds API allowance (${lastRemaining} credits reported); delayed finals will retry automatically while the Commissioner health panel keeps the condition visible.`,
    );
    return buildResult({
      eligibleGames: eligibleGames.length,
      requestsRemaining: String(lastRemaining),
      pollingMode,
      quotaProtected: true,
    });
  }

  const run = await supabaseAdmin
    .from("sync_runs")
    .insert({ provider: "The Odds API", job_type: "scores", status: "started" })
    .select("id")
    .single();
  signal?.throwIfAborted();

  if (run.error || !run.data) {
    throw new Error("The score sync run could not be recorded.");
  }

  if (eligibleGames.length === 0) {
    await finishSyncRun(run.data.id, {
        status: "success",
        completed_at: new Date().toISOString(),
        details: noScoreResult,
      });
    return noScoreResult;
  }

  let providerResponseAccepted = false;
  let providerRequestAttempted = false;
  let failedRequestsRemaining: string | null = null;
  let failedRequestsUsed: string | null = null;
  let failedRequestsLast: string | null = null;
  try {
    signal?.throwIfAborted();
    providerRequestAttempted = true;
    const providerResponse = await fetchScoreProviderEvents(oddsApiKey, fetch, signal);
    signal?.throwIfAborted();
    const { requestsRemaining, requestsUsed, requestsLast } = providerResponse;
    failedRequestsRemaining = requestsRemaining;
    failedRequestsUsed = requestsUsed;
    failedRequestsLast = requestsLast;
    providerResponseAccepted = true;

    // One paid response already contains every current NFL game. Use it to
    // settle every due game it can prove final, even when another game's
    // individual retry timer is what triggered this request.
    const completedEvents = selectCompletedProviderEvents(
      scoreDueGames,
      providerResponse.events,
    );

    if (completedEvents.length === 0) {
      signal?.throwIfAborted();
      await deferUnfinishedScoreChecks(eligibleGames, backoffByGameId, checkedAt, playoffPeriodIds);
      signal?.throwIfAborted();
      const result = buildResult({
        eligibleGames: eligibleGames.length,
        providerChecked: true,
        requestsRemaining,
        requestsUsed,
        requestsLast,
        pollingMode,
      });
      await finishSyncRun(run.data.id, { status: "success", completed_at: new Date().toISOString(), details: result });
      return result;
    }

    const savedGames = scoreDueGames.filter((game) =>
      Boolean(game.odds_event_id && completedEvents.some((event) => event.id === game.odds_event_id)),
    );
    const teamIds = [...new Set(savedGames.flatMap((game) => [game.away_team_id, game.home_team_id]))];
    const { data: teams, error: teamsError } = teamIds.length
      ? await supabaseAdmin.from("teams").select("id, full_name").in("id", teamIds)
      : { data: [], error: null };
    signal?.throwIfAborted();

    if (teamsError || !teams) throw new Error("The NFL team list could not be loaded.");

    const matchedScores = matchProviderFinalScores(
      savedGames,
      completedEvents,
      teams as Array<{ id: string; full_name: string }>,
    );
    const finalizedGames: FinalGameRow[] = matchedScores.finalizedGames;
    const unmatchedCompletedGames = matchedScores.unmatchedCompletedGames;

    if (finalizedGames.length > 0) {
      signal?.throwIfAborted();
      const { data: atomicRows, error: atomicError } = await supabaseAdmin.rpc(
        "finalize_games_atomically",
        {
          final_games: finalizedGames.map((game) => ({
            game_id: game.id,
            away_score: game.awayScore,
            home_score: game.homeScore,
          })),
          accepted_at: checkedAt,
        },
      );
      signal?.throwIfAborted();

      if (atomicError || !atomicRows?.[0]) {
        throw new Error("Final scores could not be finalized safely.");
      }
      const { error: clearBackoffError } = await supabaseAdmin
        .from("score_check_backoff")
        .delete()
        .in("game_id", finalizedGames.map((game) => game.id));
      signal?.throwIfAborted();
      if (clearBackoffError) {
        throw new Error("Final-score polling state could not be cleared safely.");
      }
      const stillUnfinished = eligibleGames.filter(
        (game) => !finalizedGames.some((finalized) => finalized.id === game.id),
      );
      await deferUnfinishedScoreChecks(stillUnfinished, backoffByGameId, checkedAt, playoffPeriodIds);
      signal?.throwIfAborted();

      const atomicResult = atomicRows[0] as {
        final_scores_imported: number;
        ats_picks_graded: number;
        survivor_picks_graded: number;
      };
      const { count: pendingAfterFinalization, error: pendingError } =
        await supabaseAdmin
          .from("picks")
          .select("id", { count: "exact", head: true })
          .in("game_id", finalizedGames.map((game) => game.id))
          .eq("result", "pending");
      signal?.throwIfAborted();

      if (pendingError) {
        throw new Error("Final pick grades could not be verified.");
      }

      const completedWeekRollover = await advanceScoringPeriods(now);
      signal?.throwIfAborted();
      await snapshotActivePlayoffEligibility();
      signal?.throwIfAborted();
      if (unmatchedCompletedGames > 0) {
        throw new Error(
          `${unmatchedCompletedGames} completed game${unmatchedCompletedGames === 1 ? "" : "s"} could not be matched to valid team scores.`,
        );
      }
      const newFinalsByRung = finalizedGames.reduce<Record<string, number>>((counts, game) => {
        const rung = String((backoffByGameId.get(game.id)?.attempts ?? 0) + 1);
        counts[rung] = (counts[rung] ?? 0) + 1;
        return counts;
      }, {});
      const result = buildResult({
        eligibleGames: eligibleGames.length,
        providerChecked: true,
        completedGamesFound: completedEvents.length,
        finalScoresImported: atomicResult.final_scores_imported,
        newFinals: finalizedGames.length,
        newFinalsByRung,
        ladderRungs: newFinalsByRung,
        picksGraded: recoveredGrades.picksGraded + atomicResult.ats_picks_graded,
        picksAwaitingLine:
          recoveredGrades.picksAwaitingLine + (pendingAfterFinalization ?? 0),
        requestsRemaining,
        requestsUsed,
        requestsLast,
        pollingMode,
        weekRollover: completedWeekRollover,
      });
      await finishSyncRun(run.data.id, { status: "success", completed_at: new Date().toISOString(), details: result });
      return result;
    }

    throw new Error(
      `The score provider marked ${unmatchedCompletedGames} game${unmatchedCompletedGames === 1 ? "" : "s"} complete, but valid team scores could not be matched safely.`,
    );
  } catch (error) {
    signal?.throwIfAborted();
    const message = error instanceof Error ? error.message : "The score sync failed.";
    if (error instanceof ScoreProviderClientError) {
      failedRequestsRemaining = error.requestsRemaining;
      failedRequestsUsed = error.requestsUsed;
      failedRequestsLast = error.requestsLast;
    }
    if (!providerResponseAccepted) {
      try {
        // Network failures, timeouts, HTTP errors, and malformed payloads use
        // the same persistent per-game exponential backoff as a delayed final.
        // The five-minute cron can then exit without spending another credit.
        await deferUnfinishedScoreChecks(eligibleGames, backoffByGameId, checkedAt, playoffPeriodIds);
        signal?.throwIfAborted();
      } catch {
        signal?.throwIfAborted();
        await finishSyncRun(run.data.id, {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `${message} The polling cooldown could not be saved safely.`,
        });
        throw new Error(`${message} The polling cooldown could not be saved safely.`);
      }
    }
    await finishSyncRun(run.data.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: message,
      details: {
        providerChecked: providerRequestAttempted,
        requestsRemaining: failedRequestsRemaining,
        requestsUsed: failedRequestsUsed,
        requestsLast: failedRequestsLast,
        pollingMode,
      },
    });
    throw error;
  }
}
