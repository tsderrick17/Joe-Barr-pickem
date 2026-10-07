import { NextRequest, NextResponse } from "next/server";
import { AutomationAlreadyRunningError, runWithAutomationLeaseContext } from "@/lib/automation-execution-lease";
import { getWatchdogStatus, runAutomationWatchdog } from "@/lib/automation-watchdog";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  try { return NextResponse.json(await getWatchdogStatus()); }
  catch { return NextResponse.json({ error: "Watchdog status could not be loaded." }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  try { return NextResponse.json({ success: true, ...(await runWithAutomationLeaseContext("watchdog", ({ signal }) => runAutomationWatchdog(new Date(), signal))) }); }
  catch (error) {
    if (error instanceof AutomationAlreadyRunningError) return NextResponse.json({ success: true, skipped: true, message: error.message });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Watchdog check failed." }, { status: 500 });
  }
}
