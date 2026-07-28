import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function authenticatedPlayer(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return null;

  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id, active, notification_email, email_notifications_enabled")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return player?.active ? player : null;
}

export async function GET(request: NextRequest) {
  const player = await authenticatedPlayer(request);
  if (!player) {
    return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });
  }

  return NextResponse.json({
    notificationEmail: player.notification_email ?? "",
    emailNotificationsEnabled: player.email_notifications_enabled,
  });
}

export async function PUT(request: NextRequest) {
  const player = await authenticatedPlayer(request);
  if (!player) {
    return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });
  }

  let body: { notificationEmail?: unknown; emailNotificationsEnabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Your notification settings were incomplete." }, { status: 400 });
  }

  const email = typeof body.notificationEmail === "string"
    ? body.notificationEmail.trim().toLowerCase()
    : "";
  const enabled = body.emailNotificationsEnabled === true;

  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (enabled && !email) {
    return NextResponse.json({ error: "Add an email address before enabling reminders." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("players")
    .update({
      notification_email: email || null,
      email_notifications_enabled: enabled,
      notification_preferences_updated_at: new Date().toISOString(),
    })
    .eq("id", player.id);

  if (error) {
    return NextResponse.json({ error: "Your notification settings could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ message: "Notification settings saved." });
}
