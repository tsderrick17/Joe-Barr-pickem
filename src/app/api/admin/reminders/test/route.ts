import { readJsonObject } from "@/lib/request-validation";
import { parseTestEmail } from "@/lib/request-bodies";
import { NextRequest, NextResponse } from "next/server";
import { deliverEmailTest } from "@/lib/email-reminders";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  const commissioner = commissionerResult.player;
  // The body is optional: a missing or malformed one is the plain test email.
  const { selectionPreview } = parseTestEmail((await readJsonObject(request)) ?? {});
  const { data: selectionTemplate } = selectionPreview
    ? await supabaseAdmin.from("reminder_templates").select("title, body").eq("template_id", "pick_due_sunday_11").maybeSingle()
    : { data: null };
  const { data: reminder, error: reminderError } = await supabaseAdmin.from("push_reminders").insert({
    created_by_player_id: commissioner.id,
    category: "custom",
    audience: "all_active",
    title: selectionPreview ? selectionTemplate?.title || "Selections still to be made" : "Joe Barr Pick'em test",
    body: selectionPreview
      ? selectionTemplate?.body || "A friendly reminder: there is still time to take care of anything waiting for you. Open the pool when you are ready."
      : "Email reminders are working for your Pick'em account.",
    scheduled_for: new Date().toISOString(),
    status: "test",
    sent_at: new Date().toISOString(),
  }).select("id, category, audience, title, body").single();
  if (reminderError) return NextResponse.json({ error: "Test reminder could not be prepared." }, { status: 500 });
  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("notification_email, email_notifications_enabled")
    .eq("id", commissioner.id)
    .single();
  if (playerError) return NextResponse.json({ error: "Your email preferences could not be checked." }, { status: 500 });
  if (!(player.email_notifications_enabled && player.notification_email)) {
    return NextResponse.json({ error: "Turn on email reminders in Notifications before sending a test." }, { status: 409 });
  }
  const email = await deliverEmailTest({ ...reminder, category: "custom", audience: "all_active" }, commissioner.id, player.notification_email);
  if (email.sent !== 1) {
    return NextResponse.json({ error: email.errors[0] ?? "Brevo did not accept the test email." }, { status: 502 });
  }
  return NextResponse.json({
    message: `${selectionPreview ? "Selections preview" : "Test email"} sent: ${email.sent} delivery.`,
    email,
  });
}
