import { NextResponse } from "next/server";
import { checkCriticalWorkerHealth } from "@/lib/critical-worker-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public and deliberately opaque: it exposes no job names or timestamps. */
export async function GET() {
  const checkedAt = new Date();
  try {
    const result = await checkCriticalWorkerHealth(checkedAt);
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
