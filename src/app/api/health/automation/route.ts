import { NextResponse } from "next/server";
import { assessAutomationHeartbeat } from "@/lib/automation-heartbeat";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public, opaque heartbeat for an external monitor. A 200 proves the database
 * watchdog has completed recently; a 503 means the monitor itself has stopped
 * or failed. No run details, credentials, or operational state are exposed.
 */
export async function GET() {
  const checkedAt = new Date();
  try {
    const { data, error } = await supabaseAdmin
      .from("sync_runs")
      .select("status,started_at,completed_at")
      .eq("job_type", "watchdog")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    const heartbeat = assessAutomationHeartbeat(data, checkedAt);
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

