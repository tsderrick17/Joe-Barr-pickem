import { NextResponse } from "next/server";
import { checkReminderHealth } from "@/lib/reminder-health";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public, monitor-friendly availability check. It intentionally returns no
 * provider details, secrets, or player data: a non-200 response is enough for
 * an uptime service to alert the Commissioner.
 */
export async function GET() {
  try {
    const { error } = await supabaseAdmin
      .from("seasons")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Public health database check failed.", {
        code: error.code,
      });
      return NextResponse.json(
        { status: "unavailable", checkedAt: new Date().toISOString() },
        {
          status: 503,
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    const reminderHealth = await checkReminderHealth();
    if (reminderHealth.problems.length) {
      console.error("Public health detected reminder delivery trouble.", reminderHealth);
      return NextResponse.json(
        { status: "degraded", checkedAt: new Date().toISOString() },
        { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    return NextResponse.json(
      { status: "ok", checkedAt: new Date().toISOString() },
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
