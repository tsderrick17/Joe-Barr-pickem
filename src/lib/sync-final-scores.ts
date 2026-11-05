import type { GameStatus } from "@/lib/db-statuses";
import {
  advanceScoringPeriods,
  type WeekRolloverResult,
} from "@/lib/advance-scoring-periods";
import { checkpoint, currentExecutionContext, ExecutionCancelledError, providerSignal } from "@/lib/execution-context";
import { FINAL_SCORE_POLLING_LIMIT_HOURS } from "@/lib/score-window";
import { SCORE_LADDER_VERSION } from "@/lib/score-retry-ladder";
import { isTierCheckDue, ladderVersionForTier, nextScoreCheckTime, tierRung } from "@/lib/score-polling-tier";
import { decideScoreTier, type ScoreTier } from "@/lib/score-tier-plan";
import { pollingModeFor, selectDueGames, selectEligibleGames } from "@/lib/score-work-plan";
import type { ScorePollingMode } from "@/lib/score-check-backoff";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishSyncRun } from "@/lib/sync-run";
import { voidDisruptedPicks } from "@/lib/void-disrupted-picks";
import { eliminateSurvivorNoPicks } from "@/lib/eliminate-survivor-no-picks";
import { ensureAnnualSeasonRollover } from "@/lib/season-rollover";

type Score = { name: string; score: string | number | null };
type ScoreEvent = {
  id: string;
  completed: boolean;
  scores?: Score[];
};
type GameRow = {
  id: string;
  external_game_id: string;
  odds_event_id: string | null;
  scoring_period_id: string;
  away_team_id: string;
  home_team_id: string;
  kickoff_at: string;
  status: GameStatus;
};
type TeamRow = { id: string; full_name: string };
type FinalGameRow = GameRow & { awayScore: number; homeScore: number };
type ScoreCheckBackoffRow = {
  game_id: string;
  attempts: number;
  last_checked_at: string;
  next_check_at: string;
};

export type ScoreSyncResult = {
  checkedAt: string;
  eligibleGames: number;
  providerChecked: boolean;
  completedGamesFound: number;
  finalScoresImported: number;
  newFinals?: number;
  newFinalsByRung?: Record<string, number>;
  ladderRungs?: Record<string, number>;
  /** Which ladder those rungs belong to (SCORE_LADDER_VERSION, with the tier added unless Normal): rung numbers only line up within one ladder. */
  ladderVersion?: string;
  /** Which score-check tier this run followed, and why (score-polling-tier.js). */
  tier?: ScoreTier;
  tierMessage?: string;
  /** The check (rung) that finalized each game this run: game id to rung, so the Grading page can say which window graded a game. */
  finalGameRungs?: Record<string, number>;
  picksGraded: number;
  picksAwaitingLine: number;
  requestsRemaining: string | null;
  requestsUsed: string | null;
  requestsLast: string | null;
  pollingMode: ScorePollingMode | "idle";
  warnings: string[];
  weekRollover: WeekRolloverResult;
  survivorNoPickEliminations: number;
};

/** When each game was last really checked (the tick that run was called for counts), or null if it never was. */
function lastCheckedMs(previous: ScoreCheckBackoffRow | undefined) {
  return previous && previous.attempts >= 1 ? Date.parse(previous.last_checked_at) : null;
}

async function deferUnfinishedScoreChecks(
  games: GameRow[],
  previousChecks: Map<string, ScoreCheckBackoffRow>,
  checkedAt: string,
  tier: ScoreTier,
) {
  if (games.length === 0) return;

  const checked = Date.parse(checkedAt);
  const rows = games.map((game) => ({
    game_id: game.id,
    attempts: (previousChecks.get(game.id)?.attempts ?? 0) + 1,
    last_checked_at: checkedAt,
    next_check_at: nextScoreCheckTime(tier, Date.parse(game.kickoff_at), checked),
    updated_at: checkedAt,
  }));
  const { error } = await supabaseAdmin
    .from("score_check_backoff")
    .upsert(rows, { onConflict: "game_id" });
  if (error) throw new Error("Delayed score checks could not be rescheduled safely.");
}

/**
 * Games the tier says to leave alone this run (not their time yet on the tier's list, or polling is paused) get their timer set to their next
 * time, so the database gate stops waking the worker for them every tick. Nothing is counted as a check.
 */
async function passOverScoreChecks(
  games: GameRow[],
  previousChecks: Map<string, ScoreCheckBackoffRow>,
  checkedAt: string,
  tier: ScoreTier,
) {
  if (games.length === 0) return;

  const passedAt = Date.parse(checkedAt);
  const rows = games.map((game) => {
    const previous = previousChecks.get(game.id);
    return {
      game_id: game.id,
      attempts: previous?.attempts ?? 0,
      last_checked_at: previous?.last_checked_at ?? checkedAt,
      next_check_at: nextScoreCheckTime(tier, Date.parse(game.kickoff_at), passedAt),
      updated_at: checkedAt,
    };
  });
  const { error } = await supabaseAdmin
    .from("score_check_backoff")
    .upsert(rows, { onConflict: "game_id" });
  if (error) throw new Error("Passed-over score checks could not be rescheduled safely.");
}

function parseScore(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  return Number(value);
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
}: {
  bypassProviderCooldown?: boolean;
} = {}): Promise<ScoreSyncResult> {
  const oddsApiKey = process.env.ODDS_API_KEY;

  if (!oddsApiKey) {
    throw new Error("The Odds API key is not configured.");
  }

  const checkedAt = new Date().toISOString();
  const now = new Date(checkedAt);
  const warnings: string[] = [];
  // Stages run in order, with a checkpoint before each so a run past its deadline stops starting new work. Every
  // stage is idempotent, so a stopped run is simply repeated by the next one.
  checkpoint("annual season check");
  await ensureAnnualSeasonRollover(checkedAt);
  checkpoint("void disrupted picks");
  await voidDisruptedPicks();
  checkpoint("settle no-contest picks");
  const { error: noContestError } = await supabaseAdmin.rpc("settle_no_contest_picks", {
    evaluated_at: checkedAt,
  });
  if (noContestError) {
    throw new Error("Declared no-contest picks could not be settled safely.");
  }
  checkpoint("Survivor no-pick eliminations");
  const noPickResult = await eliminateSurvivorNoPicks(checkedAt);
  checkpoint("recover pending grades");
  const recoveredGrades = await recoverPendingFinalPickGrades();
  checkpoint("advance scoring periods");
  const weekRollover = await advanceScoringPeriods(now);
  checkpoint("playoff eligibility snapshot");
  await snapshotActivePlayoffEligibility();
  checkpoint("read games awaiting scores");
  const providerLookbackStart = new Date(
    now.getTime() - FINAL_SCORE_POLLING_LIMIT_HOURS * 60 * 60 * 1000,
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

  if (unfinishedGamesError || !unfinishedGames) {
    throw new Error("Games awaiting final scores could not be loaded.");
  }

  const scoreDueGames = selectDueGames(unfinishedGames as GameRow[], now);
  const scorePeriodIds = [...new Set(scoreDueGames.map((game) => game.scoring_period_id))];
  const { data: scorePeriods, error: scorePeriodsError } = scorePeriodIds.length
    ? await supabaseAdmin
        .from("scoring_periods")
        .select("id, period_type")
        .in("id", scorePeriodIds)
    : { data: [], error: null };
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
          .select("game_id, attempts, last_checked_at, next_check_at")
          .in("game_id", scoreDueGames.map((game) => game.id))
      : { data: [], error: null };
  if (scoreCheckBackoffsError) {
    throw new Error("Delayed score checks could not be loaded safely.");
  }
  const backoffByGameId = new Map(
    ((scoreCheckBackoffs ?? []) as ScoreCheckBackoffRow[]).map((row) => [
      row.game_id,
      row,
    ]),
  );
  const timerDueGames = selectEligibleGames(scoreDueGames, backoffByGameId, now, bypassProviderCooldown);

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

  if (timerDueGames.length === 0 && !shouldRecordRollover) {
    return noScoreResult;
  }

  // Which tier of checking to run: Normal until the month's credits run low, then Lean or Minimal, and paused only when what is left is needed
  // for the official lines. The Commissioner's recovery run checks every due game whatever the tier says; the games it leaves alone are
  // rescheduled to their next time so the gate does not wake the worker for them again.
  const tierPlan = await decideScoreTier(now);
  const tier = tierPlan.tier;
  const eligibleGames = bypassProviderCooldown
    ? timerDueGames
    : timerDueGames.filter((game) => tier !== "paused" && isTierCheckDue(tier, Date.parse(game.kickoff_at), lastCheckedMs(backoffByGameId.get(game.id)), now.getTime()));
  await passOverScoreChecks(timerDueGames.filter((game) => !eligibleGames.includes(game)), backoffByGameId, checkedAt, tier);
  const pollingMode = pollingModeFor(eligibleGames, playoffPeriodIds);
  if (tier === "paused" && timerDueGames.length > 0 && eligibleGames.length === 0) warnings.push(tierPlan.message);
  if (eligibleGames.length === 0 && !shouldRecordRollover) {
    return buildResult({ tier, tierMessage: tierPlan.message });
  }

  const run = await supabaseAdmin
    .from("sync_runs")
    .insert({ provider: "The Odds API", job_type: "scores", status: "started" })
    .select("id")
    .single();

  if (run.error || !run.data) {
    throw new Error("The score sync run could not be recorded.");
  }

  if (eligibleGames.length === 0) {
    await finishSyncRun(run.data.id, {
        status: "success",
        completed_at: new Date().toISOString(),
        details: { ...noScoreResult, tier, tierMessage: tierPlan.message },
      });
    return noScoreResult;
  }

  checkpoint("provider request");
  let providerResponseAccepted = false;
  let providerRequestAttempted = false;
  let failedRequestsRemaining: string | null = null;
  let failedRequestsUsed: string | null = null;
  let failedRequestsLast: string | null = null;
  try {
    const query = new URLSearchParams({ apiKey: oddsApiKey, daysFrom: "3" });
    providerRequestAttempted = true;
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores/?${query}`,
      { cache: "no-store", signal: providerSignal(20_000) },
    );
    const requestsRemaining = response.headers.get("x-requests-remaining");
    const requestsUsed = response.headers.get("x-requests-used");
    const requestsLast = response.headers.get("x-requests-last");
    failedRequestsRemaining = requestsRemaining;
    failedRequestsUsed = requestsUsed;
    failedRequestsLast = requestsLast;

    if (!response.ok) {
      throw new Error("The NFL score feed could not be reached right now.");
    }

    const providerPayload: unknown = await response.json();
    if (!Array.isArray(providerPayload)) {
      throw new Error("The NFL score feed returned an invalid response.");
    }
    providerResponseAccepted = true;

    // One paid response already contains every current NFL game. Use it to
    // settle every due game it can prove final, even when another game's
    // individual retry timer is what triggered this request.
    const dueGameByExternalId = new Map(
      scoreDueGames.flatMap((game) => game.odds_event_id ? [[game.odds_event_id, game]] : []),
    );
    const completedEvents = (providerPayload as ScoreEvent[]).filter(
      (event) =>
        dueGameByExternalId.has(event.id) &&
        event.completed &&
        event.scores?.length === 2,
    );

    if (completedEvents.length === 0) {
      await deferUnfinishedScoreChecks(eligibleGames, backoffByGameId, checkedAt, tier);
      const result = buildResult({
        eligibleGames: eligibleGames.length,
        providerChecked: true,
        requestsRemaining,
        requestsUsed,
        requestsLast,
        pollingMode,
        tier,
        tierMessage: tierPlan.message,
      });
      await finishSyncRun(run.data.id, { status: "success", completed_at: new Date().toISOString(), details: result });
      return result;
    }

    const eventByExternalId = new Map(completedEvents.map((event) => [event.id, event]));
    const savedGames = scoreDueGames.filter((game) =>
      Boolean(game.odds_event_id && eventByExternalId.has(game.odds_event_id)),
    );
    const teamIds = [...new Set(savedGames.flatMap((game) => [game.away_team_id, game.home_team_id]))];
    const { data: teams, error: teamsError } = teamIds.length
      ? await supabaseAdmin.from("teams").select("id, full_name").in("id", teamIds)
      : { data: [], error: null };

    if (teamsError || !teams) throw new Error("The NFL team list could not be loaded.");

    const teamIdByName = new Map(
      (teams as TeamRow[]).map((team) => [team.full_name, team.id]),
    );
    const finalizedGames: FinalGameRow[] = [];

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

    const unmatchedCompletedGames =
      completedEvents.length - finalizedGames.length;

    if (finalizedGames.length > 0) {
      // The commit. After it the remaining steps are bookkeeping that must finish, so this is the last checkpoint.
      checkpoint("finalize games");
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

      if (atomicError || !atomicRows?.[0]) {
        throw new Error("Final scores could not be finalized safely.");
      }
      const { error: clearBackoffError } = await supabaseAdmin
        .from("score_check_backoff")
        .delete()
        .in("game_id", finalizedGames.map((game) => game.id));
      if (clearBackoffError) {
        throw new Error("Final-score polling state could not be cleared safely.");
      }
      const stillUnfinished = eligibleGames.filter(
        (game) => !finalizedGames.some((finalized) => finalized.id === game.id),
      );
      await deferUnfinishedScoreChecks(stillUnfinished, backoffByGameId, checkedAt, tier);

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

      if (pendingError) {
        throw new Error("Final pick grades could not be verified.");
      }

      const completedWeekRollover = await advanceScoringPeriods(now);
      await snapshotActivePlayoffEligibility();
      if (unmatchedCompletedGames > 0) {
        throw new Error(
          `${unmatchedCompletedGames} completed game${unmatchedCompletedGames === 1 ? "" : "s"} could not be matched to valid team scores.`,
        );
      }
      // A game's rung is its place on the tier's list of check times, so it means the same thing however the game got there.
      const rungOf = (game: FinalGameRow) => tierRung(tier, Date.parse(game.kickoff_at), now.getTime());
      const finalGameRungs = Object.fromEntries(finalizedGames.map((game) => [game.id, rungOf(game)]));
      const newFinalsByRung = finalizedGames.reduce<Record<string, number>>((counts, game) => {
        const rung = String(rungOf(game));
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
        ladderVersion: ladderVersionForTier(SCORE_LADDER_VERSION, tier),
        tier,
        tierMessage: tierPlan.message,
        finalGameRungs,
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
    const message = error instanceof Error ? error.message : "The score sync failed.";
    // A run stopped by its own deadline is not a provider failure: it must not push games onto a longer retry delay.
    const cancelledByDeadline = error instanceof ExecutionCancelledError || Boolean(currentExecutionContext()?.signal.aborted);
    if (!providerResponseAccepted && !cancelledByDeadline) {
      try {
        // Network failures, timeouts, HTTP errors, and malformed payloads use
        // the same persistent per-game exponential backoff as a delayed final.
        // The five-minute cron can then exit without spending another credit.
        await deferUnfinishedScoreChecks(eligibleGames, backoffByGameId, checkedAt, tier);
      } catch {
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
        tier,
      },
    });
    throw error;
  }
}
