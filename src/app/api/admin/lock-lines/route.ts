import { NextRequest, NextResponse } from "next/server";
import { lockDueLines } from "@/lib/lock-due-lines";
import { AutomationAlreadyRunningError, runWithAutomationLeaseContext } from "@/lib/automation-execution-lease";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);

  try {
    const result = await runWithAutomationLeaseContext("line_locks", ({ signal }) =>
      lockDueLines(new Date(), signal),
    );

    const message =
      result.dueGames === 0
        ? "No games are due for official spread locking."
        : result.missingGames.length > 0
          ? `${result.lockedGames} official lines were locked. ${result.missingGames.length} games need attention.`
          : `${result.lockedGames} official lines were locked successfully.`;

    return NextResponse.json({
      message,
      ...result,
    });
  } catch (error) {
    if (error instanceof AutomationAlreadyRunningError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message =
      error instanceof Error
        ? error.message
        : "The official line check failed.";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);

  const now = new Date().toISOString();
  const [latestResult, dueGamesResult] = await Promise.all([
    supabaseAdmin
      .from("sync_runs")
      .select("status, started_at, completed_at, details, error_message")
      .eq("job_type", "line_locks")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("games")
      .select("id")
      .in("status", ["scheduled", "live"])
      .lte("line_lock_at", now),
  ]);

  if (latestResult.error || dueGamesResult.error) {
    return NextResponse.json(
      { error: "The latest official line lock could not be loaded." },
      { status: 500 },
    );
  }

  const dueGameIds = (dueGamesResult.data ?? []).map((game) => game.id);
  const { data: lockedLines, error: lockedLinesError } = dueGameIds.length
    ? await supabaseAdmin.from("game_lines").select("game_id").in("game_id", dueGameIds)
    : { data: [], error: null };
  if (lockedLinesError) {
    return NextResponse.json(
      { error: "The current official line status could not be loaded." },
      { status: 500 },
    );
  }

  const lockedGameIds = new Set((lockedLines ?? []).map((line) => line.game_id));
  const missingCurrentLines = dueGameIds.some((gameId) => !lockedGameIds.has(gameId));
  const latestRun = latestResult.data
    ? { ...latestResult.data, needsAttention: latestResult.data.status === "failed" && missingCurrentLines }
    : null;

  return NextResponse.json({ latestRun });
}
