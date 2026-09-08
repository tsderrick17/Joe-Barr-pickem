import { NextResponse } from "next/server";
import { assessCriticalWorkerHeartbeats } from "@/lib/critical-worker-heartbeat.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public and deliberately opaque: it exposes no job names or timestamps. */
export async function GET() {
  const checkedAt = new Date();
  try {
    const [{ data, error }, { data: activePeriods, error: activePeriodsError }] = await Promise.all([
      supabaseAdmin
        .from("automation_worker_heartbeats")
        .select("job_name,last_succeeded_at,last_failed_at")
        .in("job_name", ["line_locks", "scores", "reminders"]),
      supabaseAdmin
        .from("scoring_periods")
        .select("id")
        .eq("status", "active"),
    ]);
    if (error) throw error;
    if (activePeriodsError) throw activePeriodsError;

    const activePeriodIds = (activePeriods ?? []).map((period) => period.id);
    const { data: dueLineGames, error: dueLineGamesError } = activePeriodIds.length === 0
      ? { data: [], error: null }
      : await supabaseAdmin
        .from("games")
        .select("id")
        .in("scoring_period_id", activePeriodIds)
        .eq("status", "scheduled")
        .lte("line_lock_at", checkedAt.toISOString())
        .limit(1);
    if (dueLineGamesError) throw dueLineGamesError;

    const result = assessCriticalWorkerHeartbeats(data, checkedAt, {
      lineLocksDue: (dueLineGames ?? []).length > 0,
    });
    if (!result.healthy) {
      console.error("A critical automation worker heartbeat is unavailable.", {
        problems: result.problems,
      });
    }
    return NextResponse.json(
      { status: result.healthy ? "ok" : "unavailable", checkedAt: checkedAt.toISOString() },
      {
        status: result.healthy ? 200 : 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    console.error("Critical worker heartbeat could not be completed.", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { status: "unavailable", checkedAt: checkedAt.toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
