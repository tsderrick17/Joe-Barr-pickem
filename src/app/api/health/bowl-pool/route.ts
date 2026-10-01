import { NextResponse } from "next/server";
import { checkBowlPoolHealth } from "@/lib/bowl-pool-health";
import { HEALTH_CDN_SECONDS, healthProbeCacheControl } from "@/lib/health-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await checkBowlPoolHealth();
    return NextResponse.json({ status: health.healthy ? "ok" : "unavailable" }, {
      status: health.healthy ? 200 : 503,
      headers: { "Cache-Control": healthProbeCacheControl(health.healthy, HEALTH_CDN_SECONDS.bowlPool) },
    });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
