import { NextRequest, NextResponse } from "next/server";
import { accessDenied } from "@/lib/access-response";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { vapidKeys } from "@/lib/web-push-keys";

/** The public half of the pool's notification key: what a phone needs to subscribe. The private half never leaves the server. */
export async function GET(request: NextRequest) {
  const access = await authenticateActivePlayer(request);
  if (!access.ok) return accessDenied(access);
  try {
    return NextResponse.json({ publicKey: (await vapidKeys()).publicKey }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Notifications are not available right now." }, { status: 503 });
  }
}
