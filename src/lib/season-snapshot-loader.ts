import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentSeasonYear } from "@/lib/season";
import { buildSeasonSnapshot, seasonSnapshotReleased } from "@/lib/season-snapshot.js";
import { CLOSED_CHART_MS, activeWeekState, snapshotFreshForMs } from "@/lib/season-snapshot-freshness.js";
import { readAllPages } from "@/lib/read-all-pages";

export type SeasonSnapshotPayload = ReturnType<typeof buildSeasonSnapshot> & { colorOrder: string[] };
export type SeasonSnapshotResult =
  | { ok: true; released: boolean; payload: SeasonSnapshotPayload | null; freshForMs: number }
  | { ok: false; status: 503; error: string };

/**
 * Everyone sees the same chart, so the finished payload is shared in memory for
 * as long as it can be trusted (see season-snapshot-freshness.js). Only the
 * viewer gate is evaluated per request.
 */
let cached: { at: number; freshForMs: number; released: boolean; payload: SeasonSnapshotPayload | null } | null = null;
// Simultaneous opens by the same kind of viewer share one set of reads.
const inFlight: Partial<Record<"commissioner" | "player", Promise<SeasonSnapshotResult>>> = {};

async function loadPicks(periodIds: string[]) {
  return readAllPages((from, to) => supabaseAdmin.from("picks")
    .select("player_id, scoring_period_id, game_id, result")
    .in("scoring_period_id", periodIds).order("id").range(from, to));
}

async function load(isCommissioner: boolean): Promise<SeasonSnapshotResult> {
  const seasonResult = await supabaseAdmin.from("seasons").select("id").eq("year", currentSeasonYear()).maybeSingle();
  if (seasonResult.error || !seasonResult.data) {
    return { ok: false, status: 503, error: "The current season could not be loaded." };
  }

  const [periodsResult, playersResult] = await Promise.all([
    supabaseAdmin.from("scoring_periods").select("id, display_name, display_order, status, period_type, max_picks").eq("season_id", seasonResult.data.id).order("display_order"),
    // One read for both needs. Colors follow join order across every player
    // ever added, so a new or inactive player never changes anyone's color.
    supabaseAdmin.from("players").select("id, active").order("created_at").order("id"),
  ]);
  if (periodsResult.error || playersResult.error) {
    return { ok: false, status: 503, error: "The season snapshot could not be loaded." };
  }

  const periods = periodsResult.data ?? [];
  const released = seasonSnapshotReleased(periods);
  // Commissioners can always preview; players see it from Week 6 of this season.
  // No pick data is read for a viewer who is not allowed to see the chart.
  if (!isCommissioner && !released) return { ok: true, released, payload: null, freshForMs: CLOSED_CHART_MS };

  const everyone = playersResult.data ?? [];
  const visibleIds = periods.filter((period) => period.status === "complete" || period.status === "active").map((period) => period.id);
  const activeIds = periods.filter((period) => period.status === "active").map((period) => period.id);
  const [picksResult, activeGamesResult] = await Promise.all([
    visibleIds.length ? loadPicks(visibleIds) : Promise.resolve({ data: [], error: null }),
    activeIds.length
      ? supabaseAdmin.from("games").select("id, scoring_period_id, kickoff_at").in("scoring_period_id", activeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (picksResult.error || activeGamesResult.error) {
    return { ok: false, status: 503, error: "Graded picks could not be loaded." };
  }

  // The active week is plotted for everyone at once, as soon as its last
  // Pick'em pick has settled (see season-snapshot-freshness.js).
  const now = Date.now();
  const picks = picksResult.data ?? [];
  const activePlayerIds = everyone.filter((player) => player.active).map((player) => player.id);
  const weekStates = activeIds.map((periodId) => ({
    periodId,
    ...activeWeekState({
      now,
      maxPicks: periods.find((period) => period.id === periodId)?.max_picks,
      games: (activeGamesResult.data ?? []).filter((game) => game.scoring_period_id === periodId),
      picks: picks.filter((pick) => pick.scoring_period_id === periodId),
      playerIds: activePlayerIds,
    }),
  }));
  const activeWeekSettled = new Set(weekStates.filter((week) => week.settled).map((week) => week.periodId));
  const snapshot = buildSeasonSnapshot(periods, everyone.filter((player) => player.active), picks, activeWeekSettled);
  const freshForMs = snapshotFreshForMs(now, weekStates);
  return { ok: true, released, payload: { ...snapshot, colorOrder: everyone.map((player) => player.id) }, freshForMs };
}

/** Load the chart for a signed-in viewer, from the shared short-lived cache when fresh. */
export async function loadSeasonSnapshot(isCommissioner: boolean): Promise<SeasonSnapshotResult> {
  if (cached && Date.now() - cached.at < cached.freshForMs) {
    const { released, payload, freshForMs } = cached;
    if (payload && (isCommissioner || released)) return { ok: true, released, payload, freshForMs };
    if (!payload && !released && !isCommissioner) return { ok: true, released: false, payload: null, freshForMs };
  }
  const kind = isCommissioner ? "commissioner" : "player";
  inFlight[kind] ??= load(isCommissioner).then((result) => {
    if (result.ok) cached = { at: Date.now(), freshForMs: result.freshForMs, released: result.released, payload: result.payload };
    return result;
  }).finally(() => { delete inFlight[kind]; });
  return inFlight[kind]!;
}
