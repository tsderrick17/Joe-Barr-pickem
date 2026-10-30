import { NextRequest, NextResponse } from "next/server";
import { accessDenied } from "@/lib/access-response";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { picksStillToMakeFor } from "@/lib/picks-to-make";

/** The number on the app icon for the signed-in player: picks still to make this week. */
export async function GET(request: NextRequest) {
  const access = await authenticateActivePlayer(request);
  if (!access.ok) return accessDenied(access);
  try {
    const count = (await picksStillToMakeFor([access.player.id])).get(access.player.id) ?? 0;
    return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The count could not be read." }, { status: 503 });
  }
}
