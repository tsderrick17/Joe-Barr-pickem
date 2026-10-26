import { NextRequest, NextResponse } from "next/server";
import { accessDenied } from "@/lib/access-response";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { sendPushToPlayer } from "@/lib/player-push";

/** Sends a test notification to the signed-in player's own devices, so they can see that notifications work on this phone. */
export async function POST(request: NextRequest) {
  const access = await authenticateActivePlayer(request);
  if (!access.ok) return accessDenied(access);
  try {
    const result = await sendPushToPlayer(access.player.id, { title: "Lead Pipe Locks", body: "Notifications are on for this phone.", url: "/", tag: "test" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The test notification could not be sent." }, { status: 500 });
  }
}
