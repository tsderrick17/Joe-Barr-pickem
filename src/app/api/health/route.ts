import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public, monitor-friendly availability check. It confirms that the site can
 * reach the database with both player-facing and privileged server
 * credentials. The privileged check makes a stale or revoked production key
 * visible to the main uptime monitor before it can silently stop automation.
 */
export async function GET() {
  try {
    const [playerAccess, serverAccess] = await Promise.all([
      supabase.from("seasons").select("id").limit(1),
      supabaseAdmin.from("seasons").select("id").limit(1),
    ]);

    if (playerAccess.error) throw playerAccess.error;
    if (serverAccess.error) throw serverAccess.error;

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
