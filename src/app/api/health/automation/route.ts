import { NextResponse } from "next/server";
import { assessAutomationWorkerHeartbeat } from "@/lib/automation-heartbeat";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public, opaque heartbeat for an external monitor. A 200 proves the database
 * watchdog worker has checked in recently; a 503 means the worker itself has
 * stopped or failed. Heavy diagnostic failures do not poison this liveness
 * signal. No run details, credentials, or operational state are exposed.
 */
export async function GET() {
  const checkedAt = new Date();
  try {
    const { data, error } = await supabaseAdmin
      .from("automation_worker_heartbeats")
      .select("last_succeeded_at,last_failed_at")
      .eq("job_name", "watchdog")
      .maybeSingle();
    if (error) throw error;

    const heartbeat = assessAutomationWorkerHeartbeat(data, checkedAt);
    return NextResponse.json(
      heartbeat.healthy
        ? { status: "ok", checkedAt: checkedAt.toISOString(), heartbeat: "current", ageSeconds: heartbeat.ageSeconds }
        : { status: "unavailable", checkedAt: checkedAt.toISOString() },
      {
        status: heartbeat.healthy ? 200 : 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    console.error("Automation heartbeat could not be completed.", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { status: "unavailable", checkedAt: checkedAt.toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

