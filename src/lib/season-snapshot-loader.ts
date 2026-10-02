import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentSeasonYear } from "@/lib/season";
import { buildSeasonSnapshot, seasonSnapshotReleased } from "@/lib/season-snapshot.js";
import { CLOSED_CHART_MS, snapshotFreshForMs } from "@/lib/season-snapshot-freshness.js";

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

// PostgREST returns at most 1,000 rows per request, so read picks in pages.
const PAGE = 1000;
async function loadPicks(periodIds: string[]) {
  const rows: Array<{ player_id: string; scoring_period_id: string; result: string }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin.from("picks").select("player_id, scoring_period_id, result")
      .in("scoring_period_id", periodIds).order("id").range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return { data: rows, error: null };
  }
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
      ? supabaseAdmin.from("games").select("scoring_period_id, kickoff_at").in("scoring_period_id", activeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (picksResult.error || activeGamesResult.error) {
    return { ok: false, status: 503, error: "Graded picks could not be loaded." };
  }

  // The active week is plotted for everyone at once, after its last pick settles.
  const now = Date.now();
  const picks = picksResult.data ?? [];
  const activeWeekSettled = new Set(activeIds.filter((periodId) => {
    const games = (activeGamesResult.data ?? []).filter((game) => game.scoring_period_id === periodId);
    const allKickedOff = games.length > 0 && games.every((game) => new Date(game.kickoff_at).getTime() <= now);
    const nothingPending = !picks.some((pick) => pick.scoring_period_id === periodId && pick.result === "pending");
    return allKickedOff && nothingPending;
  }));
  const snapshot = buildSeasonSnapshot(periods, everyone.filter((player) => player.active), picks, activeWeekSettled);
  const freshForMs = snapshotFreshForMs(
    now,
    (activeGamesResult.data ?? []).map((game) => new Date(game.kickoff_at).getTime()),
    activeIds.every((periodId) => activeWeekSettled.has(periodId)),
    activeIds.length > 0,
  );
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
