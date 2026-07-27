import { NextRequest, NextResponse } from "next/server";
import { lockDueLines } from "@/lib/lock-due-lines";
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

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized automation request." },
      { status: 401 },
    );
  }

  try {
    const result = await runWithAutomationLease("line_locks", lockDueLines);

    return NextResponse.json({
      success: true,
      message:
        result.dueGames === 0
          ? "No games are due for official spread locking."
          : `${result.lockedGames} official lines were locked.`,
      ...result,
    });
  } catch (error) {
    if (error instanceof AutomationAlreadyRunningError) {
      return NextResponse.json({ success: true, skipped: true, message: error.message });
    }
    const message =
      error instanceof Error
        ? error.message
        : "The automatic line check failed.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
