import { weekRolloverAt } from "@/lib/week-rollover";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PeriodRow = {
  id: string;
  display_name: string;
  display_order: number;
  status: "upcoming" | "active" | "complete";
  starts_at: string | null;
};

type GameRow = {
  id: string;
  kickoff_at: string;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled" | "no_contest";
  finalized_at: string | null;
};

export type WeekRolloverResult = {
  action: "activated" | "waiting" | "completed" | "blocked" | "none";
  currentWeek: string | null;
  nextWeek: string | null;
  rolloverAt: string | null;
  reason: string | null;
};

export async function advanceScoringPeriods(
  now = new Date(),
): Promise<WeekRolloverResult> {
  const { data: season, error: seasonError } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .eq("year", CURRENT_SEASON_YEAR)
    .maybeSingle();

  if (seasonError || !season) {
    throw new Error("The current season could not be loaded for weekly rollover.");
  }

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name, display_order, status, starts_at")
    .eq("season_id", season.id)
    .order("display_order");

  if (periodsError || !periods?.length) {
    throw new Error("Scoring periods could not be loaded for weekly rollover.");
  }

  const allPeriods = periods as PeriodRow[];
  const activePeriod = allPeriods.find((period) => period.status === "active");

  if (!activePeriod) {
    const readyPeriod = allPeriods
      .filter(
        (period) =>
          period.status === "upcoming" &&
          period.starts_at &&
          new Date(period.starts_at) <= now,
      )
      .at(-1);

    if (!readyPeriod) {
      return {
        action: "none",
        currentWeek: null,
        nextWeek: null,
        rolloverAt: null,
        reason: null,
      };
    }

    const { error: activateError } = await supabaseAdmin
      .from("scoring_periods")
      .update({ status: "active" })
      .eq("id", readyPeriod.id);

    if (activateError) {
      throw new Error("The next scoring period could not be activated.");
    }

    return {
      action: "activated",
      currentWeek: readyPeriod.display_name,
      nextWeek: null,
      rolloverAt: null,
      reason: null,
    };
  }

  const nextPeriod = allPeriods.find(
    (period) => period.display_order === activePeriod.display_order + 1,
  );
  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("id, kickoff_at, status, finalized_at")
    .eq("scoring_period_id", activePeriod.id);

  if (gamesError || !games) {
    throw new Error("The active week games could not be loaded for rollover.");
  }

  const activeGames = games as GameRow[];
  const exceptionGames = activeGames.filter(
    (game) => game.status === "postponed",
  );

  if (exceptionGames.length > 0) {
    return {
      action: "blocked",
      currentWeek: activePeriod.display_name,
      nextWeek: nextPeriod?.display_name ?? null,
      rolloverAt: null,
      reason: "A postponed game requires commissioner review or rescheduling.",
    };
  }

  // Declared cancellations and no-contests are terminal, audited outcomes.
  // They settle their affected picks through the disruption workflow instead
  // of waiting forever for a box score that will never exist.
  const unfinishedGames = activeGames.filter(
    (game) => !["final", "cancelled", "no_contest"].includes(game.status),
  );

  if (activeGames.length === 0 || unfinishedGames.length > 0) {
    return {
      action: "waiting",
      currentWeek: activePeriod.display_name,
      nextWeek: nextPeriod?.display_name ?? null,
      rolloverAt: null,
      reason: "Waiting for every game in the active week to be settled.",
    };
  }

  const { count: pendingPickCount, error: pendingPicksError } =
    await supabaseAdmin
      .from("picks")
      .select("id", { count: "exact", head: true })
      .eq("scoring_period_id", activePeriod.id)
      .eq("result", "pending");

  if (pendingPicksError) {
    throw new Error("Final pick grades could not be checked for rollover.");
  }

  if ((pendingPickCount ?? 0) > 0) {
    return {
      action: "blocked",
      currentWeek: activePeriod.display_name,
      nextWeek: nextPeriod?.display_name ?? null,
      rolloverAt: null,
      reason: "Final-game picks still need an official line or grade.",
    };
  }

  // Terminal disruptions have no final-score timestamp. Their kickoff is a
  // stable lower bound for the handoff; ordinary finals still use the
  // accepted final-score timestamp.
  const settlementTimes = activeGames
    .map((game) =>
      game.finalized_at ??
      (["cancelled", "no_contest"].includes(game.status)
        ? game.kickoff_at
        : null),
    )
    .filter((settledAt): settledAt is string => Boolean(settledAt));

  if (settlementTimes.length !== activeGames.length) {
    return {
      action: "blocked",
      currentWeek: activePeriod.display_name,
      nextWeek: nextPeriod?.display_name ?? null,
      rolloverAt: null,
      reason: "A game settlement timestamp is unavailable for the active week.",
    };
  }

  const lastFinalizedAt = settlementTimes.sort().at(-1)!;
  let nextKickoffAt: string | null = null;

  if (nextPeriod) {
    const { data: nextGames, error: nextGamesError } = await supabaseAdmin
      .from("games")
      .select("kickoff_at")
      .eq("scoring_period_id", nextPeriod.id)
      .order("kickoff_at")
      .limit(1);

    if (nextGamesError) {
      throw new Error("The next week schedule could not be loaded for rollover.");
    }

    nextKickoffAt = nextGames?.[0]?.kickoff_at ?? null;
  }

  const rolloverAt = weekRolloverAt({ lastFinalizedAt, nextKickoffAt });

  if (now < new Date(rolloverAt)) {
    return {
      action: "waiting",
      currentWeek: activePeriod.display_name,
      nextWeek: nextPeriod?.display_name ?? null,
      rolloverAt,
      reason: "Keeping the completed week visible until the scheduled handoff.",
    };
  }

  const { error: handoffError } = await supabaseAdmin.rpc(
    "complete_scoring_period_atomically",
    {
      target_scoring_period_id: activePeriod.id,
      next_scoring_period_id: nextPeriod?.id ?? null,
      rollover_at: rolloverAt,
    },
  );

  if (handoffError) {
    throw new Error("The weekly handoff could not be completed safely.");
  }

  return {
    action: "completed",
    currentWeek: activePeriod.display_name,
    nextWeek: nextPeriod?.display_name ?? null,
    rolloverAt,
    reason: null,
  };
}
