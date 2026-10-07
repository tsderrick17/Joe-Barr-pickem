import { NextRequest, NextResponse } from "next/server";
import { syncFinalScores } from "@/lib/sync-final-scores";
import { AutomationAlreadyRunningError, runWithAutomationLeaseContext } from "@/lib/automation-execution-lease";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);

  try {
    const result = await runWithAutomationLeaseContext("scores", ({ signal }) =>
      syncFinalScores({ bypassProviderCooldown: true, signal }),
    );
    return NextResponse.json({
      message:
        result.weekRollover.action === "completed"
          ? "Weekly handoff completed."
          : result.weekRollover.action === "activated"
            ? `${result.weekRollover.currentWeek} is now active.`
            : result.providerChecked
              ? "Final score check completed."
              : "No games are ready for a final score check yet.",
      ...result,
    });
  } catch (error) {
    if (error instanceof AutomationAlreadyRunningError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The final score check failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);

  const { data: latestRun, error } = await supabaseAdmin
    .from("sync_runs")
    .select("status, started_at, completed_at, details, error_message")
    .eq("job_type", "scores")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "The latest score check could not be loaded." }, { status: 500 });
  }

  return NextResponse.json({ latestRun });
}
