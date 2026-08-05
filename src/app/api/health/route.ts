import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public, monitor-friendly availability check. It confirms that the site can
 * reach the player-facing database with the same configuration the app uses.
 * Detailed automation readiness intentionally lives in the Commissioner
 * dashboard: a stale reminder must be actionable there, not falsely reported
 * to UptimeRobot as an outage of the public site.
 */
export async function GET() {
  try {
    const { error } = await supabase
      .from("seasons")
      .select("id")
      .limit(1);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      { status: "ok", checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    // Keep the public response deliberately opaque, but include the safe
    // failure shape in server logs so the Commissioner can diagnose a
    // database/configuration mismatch without exposing it to uptime probes.
    console.error("Public health check could not be completed.", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { status: "unavailable", checkedAt: new Date().toISOString() },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
