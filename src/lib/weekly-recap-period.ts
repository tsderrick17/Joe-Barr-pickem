import { supabaseAdmin } from "@/lib/supabase-admin";
import { isSettledGameStatus } from "@/lib/game-status-policy.js";

export type WeeklyRecapPeriod = {
  id: string;
  season_id: string;
  display_name: string;
  display_order: number;
  settled_at: string;
};

export async function findLatestSettledWeeklyRecapPeriod(): Promise<WeeklyRecapPeriod | null> {
  const { data: season, error: seasonError } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .in("state", ["regular_season", "playoffs", "complete"])
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (seasonError) throw new Error("The weekly recap season could not be loaded.");
  if (!season) return null;

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, season_id, display_name, display_order")
    .eq("season_id", season.id)
    .eq("period_type", "regular")
    .in("status", ["active", "complete"])
    .order("display_order", { ascending: false });
  if (periodsError) throw new Error("Weekly recap periods could not be loaded.");
  if (!periods?.length) return null;

  const periodIds = periods.map((period) => period.id);
  const [gamesResult, picksResult, survivorResult] = await Promise.all([
    supabaseAdmin
      .from("games")
      .select("scoring_period_id, status, finalized_at, kickoff_at")
      .in("scoring_period_id", periodIds),
    supabaseAdmin
      .from("picks")
      .select("scoring_period_id")
      .in("scoring_period_id", periodIds)
      .eq("result", "pending"),
    supabaseAdmin
      .from("survivor_picks")
      .select("scoring_period_id")
      .in("scoring_period_id", periodIds)
      .eq("result", "pending"),
  ]);
  if (gamesResult.error || picksResult.error || survivorResult.error) {
    throw new Error("Weekly recap settlement could not be verified.");
  }

  const pendingAtsPeriods = new Set((picksResult.data ?? []).map((pick) => pick.scoring_period_id));
  const pendingSurvivorPeriods = new Set((survivorResult.data ?? []).map((pick) => pick.scoring_period_id));

  for (const period of periods) {
    const games = (gamesResult.data ?? []).filter((game) => game.scoring_period_id === period.id);
    if (
      games.length > 0 &&
      games.every((game) => isSettledGameStatus(game.status)) &&
      !pendingAtsPeriods.has(period.id) &&
      !pendingSurvivorPeriods.has(period.id)
    ) {
      const settlementTimes = games.map((game) =>
        game.finalized_at ?? (["postponed", "cancelled", "no_contest"].includes(game.status) ? game.kickoff_at : null),
      );
      if (settlementTimes.every((value): value is string => Boolean(value))) {
        return { ...period, settled_at: settlementTimes.sort().at(-1)! } as WeeklyRecapPeriod;
      }
    }
  }

  return null;
}
