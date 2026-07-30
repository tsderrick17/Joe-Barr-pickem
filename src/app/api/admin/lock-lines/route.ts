import { NextRequest, NextResponse } from "next/server";
import { lockDueLines } from "@/lib/lock-due-lines";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
  }

  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  if (!(await requireCommissioner(request))) {
    return NextResponse.json(
      { error: "Commissioner access is required." },
      { status: 403 },
    );
  }

  try {
    const result = await runWithAutomationLease("line_locks", lockDueLines);

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
  if (!(await requireCommissioner(request))) {
    return NextResponse.json(
      { error: "Commissioner access is required." },
      { status: 403 },
    );
  }

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
