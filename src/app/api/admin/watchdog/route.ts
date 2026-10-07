import { NextRequest, NextResponse } from "next/server";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";
import { getWatchdogStatus, runAutomationWatchdog } from "@/lib/automation-watchdog";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";

export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  try { return NextResponse.json(await getWatchdogStatus()); }
  catch { return NextResponse.json({ error: "Watchdog status could not be loaded." }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  try { return NextResponse.json({ success: true, ...(await runWithAutomationLease("watchdog", runAutomationWatchdog)) }); }
  catch (error) {
    if (error instanceof AutomationAlreadyRunningError) return NextResponse.json({ success: true, skipped: true, message: error.message });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Watchdog check failed." }, { status: 500 });
  }
}
