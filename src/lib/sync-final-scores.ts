import { gradeAtsPick } from "@/lib/ats-grading";
import {
  advanceScoringPeriods,
  type WeekRolloverResult,
} from "@/lib/advance-scoring-periods";
import { isDueForFinalScoreCheck } from "@/lib/score-window";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { voidDisruptedPicks } from "@/lib/void-disrupted-picks";
import { eliminateSurvivorNoPicks } from "@/lib/eliminate-survivor-no-picks";

type Score = { name: string; score: string | number | null };
type ScoreEvent = {
  id: string;
  completed: boolean;
  scores?: Score[];
};
type GameRow = {
  id: string;
  external_game_id: string;
  scoring_period_id: string;
  away_team_id: string;
  home_team_id: string;
  kickoff_at: string;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
};
type TeamRow = { id: string; full_name: string };
type LockedLineRow = {
  game_id: string;
  favorite_team_id: string | null;
  locked_spread: number | string;
};
type PickRow = { id: string; game_id: string; selected_team_id: string };
type FinalGameRow = GameRow & { awayScore: number; homeScore: number };

export type ScoreSyncResult = {
  checkedAt: string;
  eligibleGames: number;
  providerChecked: boolean;
  completedGamesFound: number;
  finalScoresImported: number;
  picksGraded: number;
  picksAwaitingLine: number;
  requestsRemaining: string | null;
  warnings: string[];
  weekRollover: WeekRolloverResult;
  survivorNoPickEliminations: number;
};

function parseScore(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  return Number(value);
}

async function recoverPendingFinalPickGrades() {
  const { data: pendingPicks, error: pendingPicksError } = await supabaseAdmin
    .from("picks")
    .select("id, game_id, selected_team_id")
    .eq("result", "pending");

  if (pendingPicksError || !pendingPicks) {
    throw new Error("Pending final pick grades could not be loaded.");
  }

  const picks = pendingPicks as PickRow[];
  const gameIds = [...new Set(picks.map((pick) => pick.game_id))];

  if (gameIds.length === 0) {
    return { picksGraded: 0, picksAwaitingLine: 0 };
  }

  const [{ data: games, error: gamesError }, { data: lines, error: linesError }] =
    await Promise.all([
      supabaseAdmin
        .from("games")
        .select("id, external_game_id, scoring_period_id, away_team_id, home_team_id, kickoff_at, status, away_score, home_score")
        .in("id", gameIds)
        .eq("status", "final"),
      supabaseAdmin
        .from("game_lines")
        .select("game_id, favorite_team_id, locked_spread")
        .in("game_id", gameIds),
    ]);

  if (gamesError || linesError) {
    throw new Error("Pending final pick grades could not be prepared.");
  }

  const finalGames = ((games ?? []) as Array<
    GameRow & { away_score: number | null; home_score: number | null }
  >).flatMap((game) => {
    if (!Number.isInteger(game.away_score) || !Number.isInteger(game.home_score)) {
      return [];
    }

    return [{ ...game, awayScore: game.away_score, homeScore: game.home_score }];
  }) as FinalGameRow[];
  const gameById = new Map(finalGames.map((game) => [game.id, game]));
  const lineByGameId = new Map(
    ((lines ?? []) as LockedLineRow[]).map((line) => [line.game_id, line]),
  );
  const updates = picks.flatMap((pick) => {
    const game = gameById.get(pick.game_id);
    const line = lineByGameId.get(pick.game_id);

    if (!game || !line) return [];

    const result = gradeAtsPick({
      selectedTeamId: pick.selected_team_id,
      favoriteTeamId: line.favorite_team_id,
      lockedSpread: Number(line.locked_spread),
      awayTeamId: game.away_team_id,
      homeTeamId: game.home_team_id,
      awayScore: game.awayScore,
      homeScore: game.homeScore,
    });

    return result === "pending" ? [] : [{ id: pick.id, result }];
  });
  const pickIdsByResult = new Map<string, string[]>();

  for (const update of updates) {
    const pickIds = pickIdsByResult.get(update.result) ?? [];
    pickIds.push(update.id);
    pickIdsByResult.set(update.result, pickIds);
  }

  const gradeResults = await Promise.all(
    [...pickIdsByResult.entries()].map(([result, pickIds]) =>
      supabaseAdmin.from("picks").update({ result }).in("id", pickIds),
    ),
  );

  if (gradeResults.some((gradeResult) => gradeResult.error)) {
    throw new Error("Pending final pick grades could not be saved.");
  }

  const finalPickCount = picks.filter((pick) => gameById.has(pick.game_id)).length;

  return {
    picksGraded: updates.length,
    picksAwaitingLine: finalPickCount - updates.length,
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

export async function syncFinalScores(): Promise<ScoreSyncResult> {
  const oddsApiKey = process.env.ODDS_API_KEY;

  if (!oddsApiKey) {
    throw new Error("The Odds API key is not configured.");
  }

  const checkedAt = new Date().toISOString();
  const now = new Date(checkedAt);
  const warnings: string[] = [];
  await voidDisruptedPicks();
  const noPickResult = await eliminateSurvivorNoPicks(checkedAt);
  const recoveredGrades = await recoverPendingFinalPickGrades();
  const weekRollover = await advanceScoringPeriods(now);
  await snapshotActivePlayoffEligibility();
  const providerLookbackStart = new Date(
    now.getTime() - 3 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: unfinishedGames, error: unfinishedGamesError } =
    await supabaseAdmin
      .from("games")
      .select(
        "id, external_game_id, scoring_period_id, away_team_id, home_team_id, kickoff_at, status",
      )
      .in("status", ["scheduled", "live"])
      .lte("kickoff_at", checkedAt)
      .gte("kickoff_at", providerLookbackStart);

  if (unfinishedGamesError || !unfinishedGames) {
    throw new Error("Games awaiting final scores could not be loaded.");
  }

  const eligibleGames = (unfinishedGames as GameRow[]).filter((game) =>
    isDueForFinalScoreCheck(
      { kickoffAt: game.kickoff_at, status: game.status },
      now,
    ),
  );

  const noScoreResult = {
    checkedAt,
    eligibleGames: 0,
    providerChecked: false,
    completedGamesFound: 0,
    finalScoresImported: 0,
    picksGraded: recoveredGrades.picksGraded,
    picksAwaitingLine: recoveredGrades.picksAwaitingLine,
    requestsRemaining: null,
    warnings,
    weekRollover,
    survivorNoPickEliminations: noPickResult.entries_eliminated,
  };
  const shouldRecordRollover =
    weekRollover.action === "activated" ||
    weekRollover.action === "completed" ||
    recoveredGrades.picksGraded > 0;

  if (eligibleGames.length === 0 && !shouldRecordRollover) {
    return noScoreResult;
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
    await supabaseAdmin
      .from("sync_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        details: noScoreResult,
      })
      .eq("id", run.data.id);
    return noScoreResult;
  }

  try {
    const query = new URLSearchParams({ apiKey: oddsApiKey, daysFrom: "3" });
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores/?${query}`,
      { cache: "no-store", signal: AbortSignal.timeout(20_000) },
    );
    const requestsRemaining = response.headers.get("x-requests-remaining");

    if (!response.ok) {
      throw new Error("The NFL score feed could not be reached right now.");
    }

    const eligibleGameByExternalId = new Map(
      eligibleGames.map((game) => [game.external_game_id, game]),
    );
    const completedEvents = ((await response.json()) as ScoreEvent[]).filter(
      (event) =>
        eligibleGameByExternalId.has(event.id) &&
        event.completed &&
        event.scores?.length === 2,
    );

    if (completedEvents.length === 0) {
      const result = {
        checkedAt,
        eligibleGames: eligibleGames.length,
        providerChecked: true,
        completedGamesFound: 0,
        finalScoresImported: 0,
        picksGraded: recoveredGrades.picksGraded,
        picksAwaitingLine: recoveredGrades.picksAwaitingLine,
        requestsRemaining,
        warnings,
        weekRollover,
        survivorNoPickEliminations: noPickResult.entries_eliminated,
      };
      await supabaseAdmin
        .from("sync_runs")
        .update({ status: "success", completed_at: new Date().toISOString(), details: result })
        .eq("id", run.data.id);
      return result;
    }

    const eventByExternalId = new Map(completedEvents.map((event) => [event.id, event]));
    const savedGames = eligibleGames.filter((game) =>
      eventByExternalId.has(game.external_game_id),
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
      const scores = eventByExternalId.get(game.external_game_id)?.scores ?? [];
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
      const result = {
        checkedAt,
        eligibleGames: eligibleGames.length,
        providerChecked: true,
        completedGamesFound: completedEvents.length,
        finalScoresImported: atomicResult.final_scores_imported,
        picksGraded: recoveredGrades.picksGraded + atomicResult.ats_picks_graded,
        picksAwaitingLine:
          recoveredGrades.picksAwaitingLine + (pendingAfterFinalization ?? 0),
        requestsRemaining,
        warnings,
        weekRollover: completedWeekRollover,
        survivorNoPickEliminations: noPickResult.entries_eliminated,
      };
      await supabaseAdmin
        .from("sync_runs")
        .update({ status: "success", completed_at: new Date().toISOString(), details: result })
        .eq("id", run.data.id);
      return result;
    }

    throw new Error(
      `The score provider marked ${unmatchedCompletedGames} game${unmatchedCompletedGames === 1 ? "" : "s"} complete, but valid team scores could not be matched safely.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The score sync failed.";
    await supabaseAdmin.from("sync_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: message }).eq("id", run.data.id);
    throw error;
  }
}
