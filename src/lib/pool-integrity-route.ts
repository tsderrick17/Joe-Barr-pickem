import { NextResponse } from "next/server";
import { healthProbeCacheControl } from "@/lib/health-cache";
import type { ProbeOutcome } from "@/lib/pool-integrity-probes";

/**
 * The public answer of a pool-integrity probe: HTTP 200 or 503 and nothing else, like every other uptime probe. A
 * healthy answer may sit in the CDN for the probe's window; a failing one never does. The reason is logged for the
 * Commissioner's diagnosis and never sent to the monitor.
 */
export async function poolIntegrityResponse(label: string, cdnSeconds: number, check: (now: Date) => Promise<ProbeOutcome>) {
  const checkedAt = new Date();
  try {
    const outcome = await check(checkedAt);
    if (!outcome.healthy) console.error(`${label} is unhealthy.`, { reason: outcome.reason ?? null });
    return NextResponse.json(
      outcome.healthy ? { status: "ok", checkedAt: checkedAt.toISOString() } : { status: "unavailable", checkedAt: checkedAt.toISOString() },
      { status: outcome.healthy ? 200 : 503, headers: { "Cache-Control": healthProbeCacheControl(outcome.healthy, cdnSeconds) } },
    );
  } catch (error) {
    console.error(`${label} could not be completed.`, { name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ status: "unavailable", checkedAt: checkedAt.toISOString() }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
