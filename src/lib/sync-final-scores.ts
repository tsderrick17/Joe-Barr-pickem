import { gradeAtsPick } from "@/lib/ats-grading";
import {
  advanceScoringPeriods,
  type WeekRolloverResult,
} from "@/lib/advance-scoring-periods";
import { isDueForFinalScoreCheck } from "@/lib/score-window";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Score = { name: string; score: string | number | null };
type ScoreEvent = {
  id: string;
  completed: boolean;
  scores?: Score[];
};
type GameRow = {
  id: string;
  external_game_id: string;
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
        .select("id, external_game_id, away_team_id, home_team_id, kickoff_at, status, away_score, home_score")
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

export async function syncFinalScores(): Promise<ScoreSyncResult> {
  const oddsApiKey = process.env.ODDS_API_KEY;

  if (!oddsApiKey) {
    throw new Error("The Odds API key is not configured.");
  }

  const checkedAt = new Date().toISOString();
  const now = new Date(checkedAt);
  const warnings: string[] = [];
  const recoveredGrades = await recoverPendingFinalPickGrades();
  const weekRollover = await advanceScoringPeriods(now);
  const providerLookbackStart = new Date(
    now.getTime() - 3 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: unfinishedGames, error: unfinishedGamesError } =
    await supabaseAdmin
      .from("games")
      .select(
        "id, external_game_id, away_team_id, home_team_id, kickoff_at, status",
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

    for (const game of finalizedGames) {
      const { error } = await supabaseAdmin
        .from("games")
        .update({
          status: "final",
          away_score: game.awayScore,
          home_score: game.homeScore,
          finalized_at: checkedAt,
        })
        .eq("id", game.id);
      if (error) throw new Error("Final game scores could not be saved.");
    }

    const gameIds = finalizedGames.map((game) => game.id);
    const { data: lines, error: linesError } = gameIds.length
      ? await supabaseAdmin.from("game_lines").select("game_id, favorite_team_id, locked_spread").in("game_id", gameIds)
      : { data: [], error: null };
    const { data: picks, error: picksError } = gameIds.length
      ? await supabaseAdmin.from("picks").select("id, game_id, selected_team_id").in("game_id", gameIds)
      : { data: [], error: null };

    if (linesError || picksError) throw new Error("Picks or official lines could not be loaded.");

    const lineByGameId = new Map(
      ((lines ?? []) as LockedLineRow[]).map((line) => [line.game_id, line]),
    );
    const gameById = new Map(finalizedGames.map((game) => [game.id, game]));
    const gradeUpdates = ((picks ?? []) as PickRow[]).flatMap((pick) => {
      const game = gameById.get(pick.game_id);
      const line = lineByGameId.get(pick.game_id);
      if (!game || !line) return [];
      return [{
        id: pick.id,
        result: gradeAtsPick({
          selectedTeamId: pick.selected_team_id,
          favoriteTeamId: line.favorite_team_id,
          lockedSpread: Number(line.locked_spread),
          awayTeamId: game.away_team_id,
          homeTeamId: game.home_team_id,
          awayScore: game.awayScore,
          homeScore: game.homeScore,
        }),
      }];
    });

    const pickIdsByResult = new Map<string, string[]>();

    for (const update of gradeUpdates) {
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
      throw new Error("Final pick results could not be saved.");
    }

    if (finalizedGames.length > 0) {
      const { error: auditError } = await supabaseAdmin
        .from("audit_logs")
        .insert(
          finalizedGames.map((game) => ({
            actor_player_id: null,
            action: "final_score_imported",
            entity_type: "game",
            entity_id: game.id,
            details: {
              away_score: game.awayScore,
              home_score: game.homeScore,
              picks_graded: gradeUpdates.filter(
                (update) =>
                  (picks ?? []).find((pick) => pick.id === update.id)
                    ?.game_id === game.id,
              ).length,
            },
          })),
        );

      if (auditError) {
        warnings.push(
          "Final scores were saved, but their audit entries could not be recorded.",
        );
      }
    }

    const result = {
      checkedAt,
      eligibleGames: eligibleGames.length,
      providerChecked: true,
      completedGamesFound: completedEvents.length,
      finalScoresImported: finalizedGames.length,
      picksGraded: recoveredGrades.picksGraded + gradeUpdates.length,
      picksAwaitingLine:
        recoveredGrades.picksAwaitingLine +
        ((picks ?? []) as PickRow[]).filter(
          (pick) => !lineByGameId.has(pick.game_id),
        ).length,
      requestsRemaining,
      warnings,
      weekRollover,
    };
    await supabaseAdmin.from("sync_runs").update({ status: "success", completed_at: new Date().toISOString(), details: result }).eq("id", run.data.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The score sync failed.";
    await supabaseAdmin.from("sync_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: message }).eq("id", run.data.id);
    throw error;
  }
}
