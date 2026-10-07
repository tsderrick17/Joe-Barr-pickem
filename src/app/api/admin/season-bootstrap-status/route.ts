import { NextRequest, NextResponse } from "next/server";
import { AutomationAlreadyRunningError, runWithAutomationLeaseContext } from "@/lib/automation-execution-lease";
import { bootstrapFullSchedule, getSeasonBootstrapStatus } from "@/lib/full-schedule-bootstrap";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  try { return NextResponse.json(await getSeasonBootstrapStatus()); }
  catch { return NextResponse.json({ error: "Season bootstrap status could not be loaded." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  try { return NextResponse.json({ success: true, ...(await runWithAutomationLeaseContext("season_bootstrap", ({ signal }) => bootstrapFullSchedule({ automatic: true, signal }))) }); }
  catch (error) {
    if (error instanceof AutomationAlreadyRunningError) return NextResponse.json({ success: true, skipped: true, message: error.message });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Season bootstrap could not run." }, { status: 500 });
  }
}
