import { NextRequest, NextResponse } from "next/server";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";
import { bootstrapFullSchedule, prepareFullSchedule } from "@/lib/full-schedule-bootstrap";
import { requireCommissioner } from "@/lib/require-commissioner";

async function authorize(request: NextRequest) {
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) return false;
  return Boolean(await requireCommissioner(request));
}

export async function GET(request: NextRequest) {
  if (!(await authorize(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  try {
    const prepared = await prepareFullSchedule();
    const weekCounts = Object.fromEntries(Array.from({ length: 18 }, (_, index) => [index + 1, prepared.games.filter((game) => game.week === index + 1).length]));
    return NextResponse.json({ season: prepared.seasonYear, games: prepared.games.length, weeks: 18, weekCounts, source: "nflverse", note: "Validated only. No database rows were changed." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The full schedule could not be prepared." }, { status: 422 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  try {
    const result = await runWithAutomationLease("season_bootstrap", () => bootstrapFullSchedule());
    return NextResponse.json({ message: result.outcome === "already_complete" ? "The complete schedule is already loaded and pinned." : "The complete regular-season schedule is loaded and pinned. Daily reconciliation will keep it current.", ...result });
  } catch (error) {
    if (error instanceof AutomationAlreadyRunningError) return NextResponse.json({ error: error.message }, { status: 409 });
    const message = error instanceof Error ? error.message : "The full schedule could not be imported.";
    return NextResponse.json({ error: message }, { status: message.includes("review") || message.includes("conflict") ? 409 : 422 });
  }
}
