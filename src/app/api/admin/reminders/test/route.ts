import { NextRequest, NextResponse } from "next/server";
import { deliverPushReminder } from "@/lib/push-reminders";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const commissioner = await requireCommissioner(request);
  if (!commissioner) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const { data: reminder, error: reminderError } = await supabaseAdmin.from("push_reminders").insert({
    created_by_player_id: commissioner.id,
    category: "custom",
    audience: "all_active",
    title: "Joe Barr Pick'em test",
    body: "Browser reminders are working on this device.",
    scheduled_for: new Date().toISOString(),
    status: "test",
    sent_at: new Date().toISOString(),
  }).select("id, category, audience, title, body").single();
  if (reminderError) return NextResponse.json({ error: "Test reminder could not be prepared." }, { status: 500 });
  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, player_id, endpoint, p256dh, auth")
    .eq("player_id", commissioner.id);
  if (subscriptionError) return NextResponse.json({ error: "Your browser subscription could not be found." }, { status: 500 });
  if (!subscriptions?.length) return NextResponse.json({ error: "Turn on browser reminders in Preferences before sending a test." }, { status: 409 });
  const result = await deliverPushReminder(reminder, subscriptions);
  return NextResponse.json({ message: result.sent ? "Test sent to your registered browser." : "The test was recorded, but your browser did not accept it.", ...result });
}
