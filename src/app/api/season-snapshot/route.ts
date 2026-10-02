import { NextRequest, NextResponse } from "next/server";
import { authenticatedProfilePlayer } from "@/lib/authenticated-profile-player";
import { loadSeasonSnapshot } from "@/lib/season-snapshot-loader";

export async function GET(request: NextRequest) {
  const viewer = await authenticatedProfilePlayer(request);
  if (!viewer) return NextResponse.json({ error: "Your sign-in session could not be verified." }, { status: 401 });

  const result = await loadSeasonSnapshot(viewer.is_commissioner);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!result.payload) return NextResponse.json({ error: "The Season Snapshot opens in Week 6." }, { status: 403 });
  return NextResponse.json(result.payload, { headers: { "Cache-Control": "private, no-store" } });
}
