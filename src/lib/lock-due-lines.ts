import { supabaseAdmin } from "@/lib/supabase-admin";
import { voidDisruptedPicks } from "@/lib/void-disrupted-picks";
import { selectLineLockDecisions } from "@/lib/line-lock-decisions.js";
import { fetchLineLockProviderEvents } from "@/lib/line-lock-provider-client.js";

type DueGame = {
  id: string;
  external_game_id: string;
  odds_event_id: string | null;
  away_team_id: string;
  home_team_id: string;
  kickoff_at: string;
  line_lock_at: string;
};

type TeamRow = {
  id: string;
  full_name: string;
};

type HistoryRow = {
  game_id: string;
  favorite_team_id: string | null;
  spread: number | string;
  source: string;
  captured_at: string;
};

export type LockLinesResult = {
  checkedAt: string;
  dueGames: number;
  lockedGames: number;
  fallbackLocks: number;
  pickEmLocks: number;
  missingGames: string[];
  providerAvailable: boolean;
  requestsRemaining: string | null;
  requestsUsed?: string | null;
  requestsLast?: string | null;
  warnings: string[];
};

export async function lockDueLines(
  currentTime = new Date(),
  signal?: AbortSignal,
): Promise<LockLinesResult> {
  try {
    signal?.throwIfAborted();
    return await lockDueLinesInternal(currentTime, signal);
  } catch (error) {
    signal?.throwIfAborted();
    const message =
      error instanceof Error ? error.message : "The official line check failed.";

    const { error: failureRunError } = await supabaseAdmin.from("sync_runs").insert({
      provider: "The Odds API",
      job_type: "line_locks",
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: message,
    });
    if (failureRunError) console.error("A failed line-lock run could not be recorded.");

    throw error;
  }
}

async function lockDueLinesInternal(
  currentTime = new Date(),
  signal?: AbortSignal,
): Promise<LockLinesResult> {
  const oddsApiKey = process.env.ODDS_API_KEY;
  const checkedAt = currentTime.toISOString();
  const warnings: string[] = [];

  signal?.throwIfAborted();
  await voidDisruptedPicks();
  signal?.throwIfAborted();

  const { data: candidates, error: candidatesError } =
    await supabaseAdmin
      .from("games")
      .select(
        "id, external_game_id, odds_event_id, away_team_id, home_team_id, kickoff_at, line_lock_at",
      )
      .eq("status", "scheduled")
      .lte("line_lock_at", checkedAt)
      .gt("kickoff_at", checkedAt)
      .order("line_lock_at");
  signal?.throwIfAborted();

  if (candidatesError) {
    throw new Error("Games due for line locking could not be loaded.");
  }

  const candidateGames = (candidates ?? []) as DueGame[];

  if (candidateGames.length === 0) {
    return {
      checkedAt,
      dueGames: 0,
      lockedGames: 0,
      fallbackLocks: 0,
      pickEmLocks: 0,
      missingGames: [],
      providerAvailable: true,
      requestsRemaining: null,
      warnings,
    };
  }

  const candidateIds = candidateGames.map((game) => game.id);

  const { data: existingLines, error: existingLinesError } =
    await supabaseAdmin
      .from("game_lines")
      .select("game_id")
      .in("game_id", candidateIds);
  signal?.throwIfAborted();

  if (existingLinesError) {
    throw new Error("Existing official lines could not be checked.");
  }

  const alreadyLocked = new Set(
    (existingLines ?? []).map((line) => line.game_id),
  );

  const dueGames = candidateGames.filter(
    (game) => !alreadyLocked.has(game.id),
  );

  if (dueGames.length === 0) {
    return {
      checkedAt,
      dueGames: 0,
      lockedGames: 0,
      fallbackLocks: 0,
      pickEmLocks: 0,
      missingGames: [],
      providerAvailable: true,
      requestsRemaining: null,
      warnings,
    };
  }

  // Outside a live line-lock window, no provider credential is needed. This
  // keeps preseason and quiet-week cron checks from creating false failures.
  if (!oddsApiKey) {
    throw new Error("The Odds API key is not configured for a game that needs an official line.");
  }
  const configuredOddsApiKey = oddsApiKey;

  const teamIds = [
    ...new Set(
      dueGames.flatMap((game) => [
        game.away_team_id,
        game.home_team_id,
      ]),
    ),
  ];

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, full_name")
    .in("id", teamIds);
  signal?.throwIfAborted();

  if (teamsError || !teams) {
    throw new Error("The NFL team list could not be loaded.");
  }

  const teamNameById = new Map(
    (teams as TeamRow[]).map((team) => [
      team.id,
      team.full_name,
    ]),
  );

  const teamIdByName = new Map(
    (teams as TeamRow[]).map((team) => [
      team.full_name,
      team.id,
    ]),
  );

  const dueGameIds = dueGames.map((game) => game.id);

  const { data: history, error: historyError } =
    await supabaseAdmin
      .from("spread_history")
      .select(
        "game_id, favorite_team_id, spread, source, captured_at",
      )
      .in("game_id", dueGameIds)
      .order("captured_at", { ascending: false });
  signal?.throwIfAborted();

  if (historyError) {
    throw new Error("Saved spread history could not be loaded.");
  }

  const latestHistoryByGameId = new Map<string, HistoryRow>();

  for (const line of (history ?? []) as HistoryRow[]) {
    if (!latestHistoryByGameId.has(line.game_id)) {
      latestHistoryByGameId.set(line.game_id, line);
    }
  }

  const provider = await fetchLineLockProviderEvents(configuredOddsApiKey, fetch, signal);
  signal?.throwIfAborted();
  if (provider.warning) warnings.push(provider.warning);

  const { decisions, missingGames, warnings: decisionWarnings } =
    selectLineLockDecisions({
      dueGames,
      oddsEvents: provider.events,
      latestHistoryByGameId,
      teamNameById,
      teamIdByName,
      checkedAt,
    });
  warnings.push(...decisionWarnings);

  let lockedCount = 0;

  if (decisions.length > 0) {
    // Do not start a new commit after timeout. An RPC already in flight may
    // still commit, so the retained lease and atomic write remain essential.
    signal?.throwIfAborted();
    // The official line, its history snapshot, and its audit entry are saved
    // together. If any part fails, none of it is saved and the next run retries.
    const { data: savedCount, error: lockError } = await supabaseAdmin.rpc(
      "lock_official_lines_atomically",
      {
        decisions: decisions.map((decision) => ({
          game_id: decision.gameId,
          favorite_team_id: decision.favoriteTeamId,
          spread: decision.spread,
          source: decision.source,
          source_captured_at: decision.sourceCapturedAt,
          used_fallback: decision.usedFallback,
          pick_em: decision.wasPickEm,
          record_history: decision.recordHistory,
        })),
        locked_at: checkedAt,
      },
    );
    signal?.throwIfAborted();

    if (lockError || typeof savedCount !== "number") {
      throw new Error("The official game lines could not be saved.");
    }

    lockedCount = savedCount;
    if (lockedCount < decisions.length) {
      warnings.push(
        "Some official lines were already locked by another process and were left unchanged.",
      );
    }
  }

  const result = {
    checkedAt,
    dueGames: dueGames.length,
    lockedGames: lockedCount,
    fallbackLocks: decisions.filter(
      (decision) => decision.usedFallback,
    ).length,
    pickEmLocks: decisions.filter(
      (decision) => decision.wasPickEm,
    ).length,
    missingGames,
    providerAvailable: provider.providerAvailable,
    requestsRemaining: provider.requestsRemaining,
    requestsUsed: provider.requestsUsed,
    requestsLast: provider.requestsLast,
    warnings,
  };

  signal?.throwIfAborted();
  const { error: runError } = await supabaseAdmin
    .from("sync_runs")
    .insert({
      provider: "The Odds API",
      job_type: "line_locks",
      status: "success",
      completed_at: new Date().toISOString(),
      details: result,
    });
  signal?.throwIfAborted();

  if (runError) {
    warnings.push(
      "Official lines were locked, but the run history could not be recorded.",
    );
  }

  return result;
}
