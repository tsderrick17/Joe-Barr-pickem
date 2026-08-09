import { NextRequest, NextResponse } from "next/server";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";
import { runAutomationWatchdog } from "@/lib/automation-watchdog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "The automation secret is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized automation request." }, { status: 401 });
  try { return NextResponse.json({ success: true, ...(await runWithAutomationLease("watchdog", runAutomationWatchdog)) }); }
  catch (error) {
    if (error instanceof AutomationAlreadyRunningError) return NextResponse.json({ success: true, skipped: true, message: error.message });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The operations watchdog failed." }, { status: 500 });
  }
}
