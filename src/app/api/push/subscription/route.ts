import { NextRequest, NextResponse } from "next/server";
import { accessDenied } from "@/lib/access-response";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { isPushEndpoint, readSubscription } from "@/lib/push-endpoint.js";
import { readJsonObject } from "@/lib/request-validation";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** A player's phones and tablets; the limit only stops a runaway page from filling the table. */
const MAX_DEVICES = 10;

/** Saves this phone's notification subscription for the signed-in player. Saving the same phone again only refreshes it. */
export async function PUT(request: NextRequest) {
  const access = await authenticateActivePlayer(request);
  if (!access.ok) return accessDenied(access);
  const subscription = readSubscription(await readJsonObject(request));
  if (!subscription) return NextResponse.json({ error: "That phone's notification details were not valid." }, { status: 400 });

  const { data: existing, error: readError } = await supabaseAdmin.from("push_subscriptions").select("endpoint").eq("player_id", access.player.id);
  if (readError) return NextResponse.json({ error: "Notifications could not be turned on." }, { status: 500 });
  if ((existing ?? []).length >= MAX_DEVICES && !(existing ?? []).some((row) => row.endpoint === subscription.endpoint)) {
    return NextResponse.json({ error: "This account already has notifications on ten devices. Turn one off first." }, { status: 409 });
  }
  // The address belongs to one phone: if another player used it before (a shared phone), it now belongs to the player signed in.
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    { player_id: access.player.id, endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth, updated_at: new Date().toISOString() },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: "Notifications could not be turned on." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Forgets this phone's subscription (the player turned notifications off here). */
export async function DELETE(request: NextRequest) {
  const access = await authenticateActivePlayer(request);
  if (!access.ok) return accessDenied(access);
  const body = await readJsonObject(request);
  if (!body || !isPushEndpoint(body.endpoint)) return NextResponse.json({ error: "That phone's notification details were not valid." }, { status: 400 });
  const { error } = await supabaseAdmin.from("push_subscriptions").delete().eq("player_id", access.player.id).eq("endpoint", body.endpoint as string);
  if (error) return NextResponse.json({ error: "Notifications could not be turned off." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
