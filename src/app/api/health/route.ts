import { NextResponse } from "next/server";
import { checkAutomationHealth } from "@/lib/automation-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public, monitor-friendly availability check. It intentionally returns no
 * provider details, secrets, or player data: a non-200 response is enough for
 * an uptime service to alert the Commissioner.
 */
export async function GET() {
  try {
    const health = await checkAutomationHealth();
    if (health.status !== "healthy") {
      console.error("Public health detected automation trouble.", {
        problemCount: health.problems.length,
      });
      return NextResponse.json(
        { status: "degraded", checkedAt: health.checkedAt },
        { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    return NextResponse.json(
      { status: "ok", checkedAt: health.checkedAt },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    console.error("Public health check could not be completed.");
    return NextResponse.json(
      { status: "unavailable", checkedAt: new Date().toISOString() },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
