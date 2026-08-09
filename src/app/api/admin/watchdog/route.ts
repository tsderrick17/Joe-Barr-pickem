import { NextRequest, NextResponse } from "next/server";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";
import { getWatchdogStatus, runAutomationWatchdog } from "@/lib/automation-watchdog";
import { requireCommissioner } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  try { return NextResponse.json(await getWatchdogStatus()); }
  catch { return NextResponse.json({ error: "Watchdog status could not be loaded." }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  try { return NextResponse.json({ success: true, ...(await runWithAutomationLease("watchdog", runAutomationWatchdog)) }); }
  catch (error) {
    if (error instanceof AutomationAlreadyRunningError) return NextResponse.json({ success: true, skipped: true, message: error.message });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Watchdog check failed." }, { status: 500 });
  }
}
