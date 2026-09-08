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
    const { data: dueGames, error: dueGamesError } = activePeriodIds.length === 0
      ? { data: [], error: null }
      : await supabaseAdmin
        .from("games")
        .select("id, kickoff_at, line_lock_at, status")
        .in("scoring_period_id", activePeriodIds)
        .in("status", ["scheduled", "live"]);
    if (dueGamesError) throw dueGamesError;

    const dueLineGames = (dueGames ?? []).filter((game) => new Date(game.line_lock_at).getTime() <= checkedAt.getTime());
    const dueScoreGames = (dueGames ?? []).filter((game) => new Date(game.kickoff_at).getTime() <= checkedAt.getTime());
    const { data: dueReminders, error: dueRemindersError } = await supabaseAdmin
      .from("push_reminders")
      .select("id")
      .in("status", ["scheduled", "sending"])
      .lte("scheduled_for", checkedAt.toISOString())
      .limit(1);
    if (dueRemindersError) throw dueRemindersError;

    const result = assessCriticalWorkerHeartbeats(data, checkedAt, {
      lineLocksDue: dueLineGames.length > 0,
      scoresDue: dueScoreGames.length > 0,
      remindersDue: (dueReminders ?? []).length > 0,
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
