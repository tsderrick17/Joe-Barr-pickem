import { NextResponse } from "next/server";
import { checkCriticalWorkerHealth } from "@/lib/critical-worker-health";
import { isProbeHealthyAfterDebounce } from "@/lib/health-probe-debounce.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public and deliberately opaque: it exposes no job names or timestamps. */
export async function GET() {
  const checkedAt = new Date();
  try {
    const result = await checkCriticalWorkerHealth(checkedAt);
    const { data: priorState, error: stateError } = await supabaseAdmin
      .from("health_probe_states")
      .select("unhealthy_since")
      .eq("probe_name", "critical_workers")
      .maybeSingle();
    if (stateError) throw stateError;

    const unhealthySince = result.healthy
      ? null
      : priorState?.unhealthy_since ?? checkedAt.toISOString();
    const { error: saveStateError } = await supabaseAdmin
      .from("health_probe_states")
      .upsert({
        probe_name: "critical_workers",
        unhealthy_since: unhealthySince,
        last_checked_at: checkedAt.toISOString(),
        updated_at: checkedAt.toISOString(),
      }, { onConflict: "probe_name" });
    if (saveStateError) throw saveStateError;

    const debouncedHealthy = isProbeHealthyAfterDebounce({ healthy: result.healthy, unhealthySince }, checkedAt);
    if (!debouncedHealthy) {
      console.error("A critical automation worker heartbeat is unavailable.", {
        problems: result.problems,
      });
    }
    return NextResponse.json(
      { status: debouncedHealthy ? "ok" : "unavailable", checkedAt: checkedAt.toISOString() },
      {
        status: debouncedHealthy ? 200 : 503,
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
