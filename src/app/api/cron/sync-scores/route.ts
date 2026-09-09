import { NextRequest, NextResponse } from "next/server";
import { syncFinalScores } from "@/lib/sync-final-scores";
import { syncBowlPool } from "@/lib/sync-bowl-pool";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "The automation secret is not configured." },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized automation request." },
      { status: 401 },
    );
  }

  try {
    const nfl = await runWithAutomationLease("scores", syncFinalScores);
    const bowl = await runWithAutomationLease("bowl_scores", syncBowlPool);
    const result = { nfl, bowl };
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AutomationAlreadyRunningError) {
      return NextResponse.json({ success: true, skipped: true, message: error.message });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "The score sync failed." },
      { status: 500 },
    );
  }
}
