import { supabaseAdmin } from "@/lib/supabase-admin";
import { calculatePlayoffEligibility } from "./playoff-math.js";

type Player = { id: string };
type SnapshotRow = {
  player_id: string;
  is_eligible: boolean;
  leader_wins_at_day_start: number;
  remaining_possible_wins: number;
};

export async function loadPlayoffEligibility(seasonId: string, targetPeriodId: string, players: Player[]) {
  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_order, period_type, status, max_picks")
    .eq("season_id", seasonId)
    .order("display_order");
  if (periodsError || !periods) throw new Error("Playoff eligibility could not be calculated.");

  const target = periods.find((period) => period.id === targetPeriodId);
  const applies = target?.period_type === "playoff" && target.status === "active";
  if (!applies) return calculatePlayoffEligibility({ players, periods, games: [], picks: [], targetPeriodId });

  // The database creates an immutable, Eastern-game-day snapshot before it
  // answers the page or pick-save request. Every request during that day then
  // reads the same decision, even after early games have finished.
  const { data: snapshotRun, error: snapshotError } = await supabaseAdmin.rpc(
    "snapshot_playoff_day_eligibility",
    { target_scoring_period_id: targetPeriodId },
  );
  const snapshotDay = snapshotRun?.[0]?.snapshot_day as string | undefined;
  if (snapshotError || !snapshotDay) throw new Error("Playoff eligibility could not be snapshotted safely.");

  const { data: snapshotRows, error: rowsError } = await supabaseAdmin
    .from("playoff_day_eligibility")
    .select("player_id, is_eligible, leader_wins_at_day_start, remaining_possible_wins")
    .eq("scoring_period_id", targetPeriodId)
    .eq("game_day", snapshotDay);
  if (rowsError || !snapshotRows || snapshotRows.length !== players.length) {
    throw new Error("Playoff eligibility could not be loaded safely.");
  }

  const rows = snapshotRows as SnapshotRow[];
  return {
    applies: true,
    snapshotDay,
    leaderWinsAtDayStart: rows[0]?.leader_wins_at_day_start ?? 0,
    remainingPossibleWins: rows[0]?.remaining_possible_wins ?? 0,
    eliminatedPlayerIds: new Set(rows.filter((row) => !row.is_eligible).map((row) => row.player_id)),
  };
}
