import { NextRequest, NextResponse } from "next/server";
import { authenticatedProfilePlayer } from "@/lib/authenticated-profile-player";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PushSubscriptionInput = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function validSubscription(value: unknown): value is Required<PushSubscriptionInput> & { keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== "object") return false;
  const subscription = value as PushSubscriptionInput;
  return typeof subscription.endpoint === "string"
    && subscription.endpoint.startsWith("https://")
    && subscription.endpoint.length <= 4096
    && typeof subscription.keys?.p256dh === "string"
    && subscription.keys.p256dh.length > 20
    && typeof subscription.keys?.auth === "string"
    && subscription.keys.auth.length > 10;
}

export async function POST(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });

  let body: { subscription?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Your browser notification subscription was incomplete." }, { status: 400 });
  }
  if (!validSubscription(body.subscription)) {
    return NextResponse.json({ error: "Your browser did not provide a valid notification subscription." }, { status: 400 });
  }

  const subscription = body.subscription;
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, player_id")
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Your browser notification could not be saved." }, { status: 500 });
  if (existing && existing.player_id !== player.id) {
    return NextResponse.json({ error: "This browser is already registered to a different player." }, { status: 409 });
  }

  const payload = {
    player_id: player.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await supabaseAdmin.from("push_subscriptions").update(payload).eq("id", existing.id)
    : await supabaseAdmin.from("push_subscriptions").insert(payload);
  if (error) return NextResponse.json({ error: "Your browser notification could not be saved." }, { status: 500 });

  return NextResponse.json({ message: "Browser notifications are on for this device." });
}

export async function DELETE(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });

  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Your browser notification subscription was incomplete." }, { status: 400 });
  }
  if (typeof body.endpoint !== "string" || body.endpoint.length > 4096) {
    return NextResponse.json({ error: "Your browser notification subscription was incomplete." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("player_id", player.id)
    .eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ error: "Your browser notification could not be removed." }, { status: 500 });

  return NextResponse.json({ message: "Browser notifications are off for this device." });
}
