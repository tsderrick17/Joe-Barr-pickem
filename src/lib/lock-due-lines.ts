import { supabaseAdmin } from "@/lib/supabase-admin";
import { voidDisruptedPicks } from "@/lib/void-disrupted-picks";

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

type OddsOutcome = {
  name: string;
  point?: number;
};

type OddsEvent = {
  id: string;
  bookmakers?: Array<{
    key: string;
    markets?: Array<{
      key: string;
      outcomes?: OddsOutcome[];
    }>;
  }>;
};

type LockDecision = {
  gameId: string;
  favoriteTeamId: string;
  spread: number;
  source: string;
  sourceCapturedAt: string;
  usedFallback: boolean;
  wasPickEm: boolean;
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
  warnings: string[];
};

function deterministicTeamId(game: DueGame) {
  const characterTotal = game.external_game_id
    .split("")
    .reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    );

  return characterTotal % 2 === 0
    ? game.away_team_id
    : game.home_team_id;
}

export async function lockDueLines(
  currentTime = new Date(),
): Promise<LockLinesResult> {
  try {
    return await lockDueLinesInternal(currentTime);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The official line check failed.";

    await supabaseAdmin.from("sync_runs").insert({
      provider: "The Odds API",
      job_type: "line_locks",
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: message,
    });

    throw error;
  }
}

async function lockDueLinesInternal(
  currentTime = new Date(),
): Promise<LockLinesResult> {
  const oddsApiKey = process.env.ODDS_API_KEY;
  const checkedAt = currentTime.toISOString();
  const warnings: string[] = [];

  await voidDisruptedPicks();

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

  if (historyError) {
    throw new Error("Saved spread history could not be loaded.");
  }

  const latestHistoryByGameId = new Map<string, HistoryRow>();

  for (const line of (history ?? []) as HistoryRow[]) {
    if (!latestHistoryByGameId.has(line.game_id)) {
      latestHistoryByGameId.set(line.game_id, line);
    }
  }

  let providerAvailable = true;
  let requestsRemaining: string | null = null;
  let oddsEvents: OddsEvent[] = [];

  try {
    const query = new URLSearchParams({
      apiKey: configuredOddsApiKey,
      regions: "us",
      markets: "spreads",
      bookmakers: "draftkings",
      oddsFormat: "american",
    });

    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?${query}`,
      { cache: "no-store", signal: AbortSignal.timeout(20_000) },
    );

    requestsRemaining =
      response.headers.get("x-requests-remaining");

    if (!response.ok) {
      providerAvailable = false;
      warnings.push(
        "The live odds provider was unavailable. Last known lines were used where possible.",
      );
    } else {
      oddsEvents = (await response.json()) as OddsEvent[];
    }
  } catch {
    providerAvailable = false;
    warnings.push(
      "The live odds provider could not be reached. Last known lines were used where possible.",
    );
  }

  const eventByExternalId = new Map(
    oddsEvents.map((event) => [event.id, event]),
  );

  const decisions: LockDecision[] = [];
  const newHistoryRows: Array<{
    game_id: string;
    favorite_team_id: string;
    spread: number;
    source: string;
    captured_at: string;
  }> = [];
  const missingGames: string[] = [];

  for (const game of dueGames) {
    const event = game.odds_event_id
      ? eventByExternalId.get(game.odds_event_id)
      : undefined;
    const draftKings = event?.bookmakers?.find(
      (bookmaker) => bookmaker.key === "draftkings",
    );
    const spreadMarket = draftKings?.markets?.find(
      (market) => market.key === "spreads",
    );
    const outcomes = spreadMarket?.outcomes ?? [];

    const favorite = outcomes.find(
      (outcome) =>
        typeof outcome.point === "number" &&
        outcome.point < 0,
    );

    const isPickEm =
      outcomes.length === 2 &&
      outcomes.every(
        (outcome) =>
          typeof outcome.point === "number" &&
          outcome.point === 0,
      );

    if (favorite) {
      const favoriteTeamId = teamIdByName.get(favorite.name);

      if (favoriteTeamId) {
        const spread = Math.abs(favorite.point ?? 0);

        decisions.push({
          gameId: game.id,
          favoriteTeamId,
          spread,
          source: "DraftKings",
          sourceCapturedAt: checkedAt,
          usedFallback: false,
          wasPickEm: false,
        });

        newHistoryRows.push({
          game_id: game.id,
          favorite_team_id: favoriteTeamId,
          spread,
          source: "DraftKings",
          captured_at: checkedAt,
        });

        continue;
      }
    }

    if (isPickEm) {
      const previousLine = latestHistoryByGameId.get(game.id);
      const favoriteTeamId =
        previousLine?.favorite_team_id ??
        deterministicTeamId(game);

      decisions.push({
        gameId: game.id,
        favoriteTeamId,
        spread: 0,
        source: "DraftKings",
        sourceCapturedAt: checkedAt,
        usedFallback: false,
        wasPickEm: true,
      });

      newHistoryRows.push({
        game_id: game.id,
        favorite_team_id: favoriteTeamId,
        spread: 0,
        source: "DraftKings",
        captured_at: checkedAt,
      });

      continue;
    }

    const previousLine = latestHistoryByGameId.get(game.id);

    if (previousLine?.favorite_team_id) {
      decisions.push({
        gameId: game.id,
        favoriteTeamId: previousLine.favorite_team_id,
        spread: Number(previousLine.spread),
        source: `${previousLine.source} - last known`,
        sourceCapturedAt: previousLine.captured_at,
        usedFallback: true,
        wasPickEm: Number(previousLine.spread) === 0,
      });

      continue;
    }

    const awayTeam =
      teamNameById.get(game.away_team_id) ?? "Unknown team";
    const homeTeam =
      teamNameById.get(game.home_team_id) ?? "Unknown team";

    missingGames.push(`${awayTeam} at ${homeTeam}`);
  }

  if (newHistoryRows.length > 0) {
    const { error: snapshotError } = await supabaseAdmin
      .from("spread_history")
      .insert(newHistoryRows);

    if (snapshotError) {
      warnings.push(
        "Official lines were captured, but their preliminary-history snapshots could not be saved.",
      );
    }
  }

  if (decisions.length > 0) {
    const { error: lockError } = await supabaseAdmin
      .from("game_lines")
      .upsert(
        decisions.map((decision) => ({
          game_id: decision.gameId,
          favorite_team_id: decision.favoriteTeamId,
          locked_spread: decision.spread,
          source: decision.source,
          source_captured_at: decision.sourceCapturedAt,
          locked_at: checkedAt,
          manual_override: false,
        })),
        {
          onConflict: "game_id",
          ignoreDuplicates: true,
        },
      );

    if (lockError) {
      throw new Error("The official game lines could not be saved.");
    }

    const { error: auditError } = await supabaseAdmin
      .from("audit_logs")
      .insert(
        decisions.map((decision) => ({
          actor_player_id: null,
          action: "official_line_locked",
          entity_type: "game",
          entity_id: decision.gameId,
          details: {
            spread: decision.spread,
            source: decision.source,
            source_captured_at: decision.sourceCapturedAt,
            used_fallback: decision.usedFallback,
            pick_em: decision.wasPickEm,
          },
        })),
      );

    if (auditError) {
      warnings.push(
        "The official lines were saved, but the audit entries could not be recorded.",
      );
    }
  }

  const result = {
    checkedAt,
    dueGames: dueGames.length,
    lockedGames: decisions.length,
    fallbackLocks: decisions.filter(
      (decision) => decision.usedFallback,
    ).length,
    pickEmLocks: decisions.filter(
      (decision) => decision.wasPickEm,
    ).length,
    missingGames,
    providerAvailable,
    requestsRemaining,
    warnings,
  };

  const { error: runError } = await supabaseAdmin
    .from("sync_runs")
    .insert({
      provider: "The Odds API",
      job_type: "line_locks",
      status: "success",
      completed_at: new Date().toISOString(),
      details: result,
    });

  if (runError) {
    warnings.push(
      "Official lines were locked, but the run history could not be recorded.",
    );
  }

  return result;
}
