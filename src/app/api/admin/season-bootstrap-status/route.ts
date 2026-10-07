import { NextRequest, NextResponse } from "next/server";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";
import { bootstrapFullSchedule, getSeasonBootstrapStatus } from "@/lib/full-schedule-bootstrap";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";

export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  try { return NextResponse.json(await getSeasonBootstrapStatus()); }
  catch { return NextResponse.json({ error: "Season bootstrap status could not be loaded." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  try { return NextResponse.json({ success: true, ...(await runWithAutomationLease("season_bootstrap", () => bootstrapFullSchedule({ automatic: true }))) }); }
  catch (error) {
    if (error instanceof AutomationAlreadyRunningError) return NextResponse.json({ success: true, skipped: true, message: error.message });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Season bootstrap could not run." }, { status: 500 });
  }
}
