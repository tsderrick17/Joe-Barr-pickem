import { NextRequest, NextResponse } from "next/server";
import { syncBowlPool } from "@/lib/sync-bowl-pool";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "The automation secret is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized automation request." }, { status: 401 });
  try {
    return NextResponse.json({ success: true, bowl: await runWithAutomationLease("bowl_scores", syncBowlPool) });
  } catch (error) {
    if (error instanceof AutomationAlreadyRunningError) return NextResponse.json({ success: true, skipped: true, message: error.message });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Bowl Pool sync failed." }, { status: 500 });
  }
}
