import { NextRequest, NextResponse } from "next/server";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { loadSeasonSnapshot } from "@/lib/season-snapshot-loader";

export async function GET(request: NextRequest) {
  const access = await authenticateActivePlayer(request);
  if (!access.ok) {
    const error = access.status === 503
      ? "Your player access could not be checked right now. Please try again."
      : access.status === 500
        ? "Player access is not configured."
        : access.status === 403
          ? "This pool identity is not active."
          : "Your sign-in session could not be verified.";
    return NextResponse.json({ error, code: access.code }, { status: access.status });
  }

  const result = await loadSeasonSnapshot(access.player.is_commissioner);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!result.payload) return NextResponse.json({ error: "The Season Snapshot opens in Week 6." }, { status: 403 });
  return NextResponse.json(result.payload, { headers: { "Cache-Control": "private, no-store" } });
}
