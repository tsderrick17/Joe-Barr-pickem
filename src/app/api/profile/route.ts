import { NextRequest, NextResponse } from "next/server";
import { authenticatedProfilePlayer } from "@/lib/authenticated-profile-player";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) {
    return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });
  }

  return NextResponse.json({
    notificationEmail: player.notification_email ?? "",
    emailNotificationsEnabled: player.email_notifications_enabled,
  });
}

export async function PUT(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
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

  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("players")
    .update({
      notification_email: email || null,
      // Email delivery is intentionally inactive until the pool has a verified sending domain.
      email_notifications_enabled: false,
      notification_preferences_updated_at: new Date().toISOString(),
    })
    .eq("id", player.id);

  if (error) {
    return NextResponse.json({ error: "Your notification settings could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ message: "Contact email saved." });
}
