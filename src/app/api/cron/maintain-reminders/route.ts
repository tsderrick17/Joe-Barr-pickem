import { NextRequest, NextResponse } from "next/server";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";
import { skipOutsideSeason } from "@/lib/off-season-gate";
import { maintainAutomaticReminderSchedule } from "@/lib/automatic-reminder-maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "The automation secret is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized automation request." }, { status: 401 });
  }
  const idle = await skipOutsideSeason("season");
  if (idle) return idle;
  try {
    return NextResponse.json({ success: true, ...(await runWithAutomationLease("reminder_schedule", maintainAutomaticReminderSchedule)) });
  } catch (error) {
    if (error instanceof AutomationAlreadyRunningError) return NextResponse.json({ success: true, skipped: true, message: error.message });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Automatic reminder schedules could not be reconciled." }, { status: 500 });
  }
}
