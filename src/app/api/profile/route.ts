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
    emailWeeklyEnabled: player.email_weekly_enabled,
    emailAtsDueEnabled: player.email_ats_due_enabled,
    emailSurvivorDueEnabled: player.email_survivor_due_enabled,
    emailCustomEnabled: player.email_custom_enabled,
    pushWeeklyEnabled: player.push_weekly_enabled,
    pushAtsDueEnabled: player.push_ats_due_enabled,
    pushSurvivorDueEnabled: player.push_survivor_due_enabled,
    pushCustomEnabled: player.push_custom_enabled,
  });
}

export async function PUT(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) {
    return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });
  }

  let body: { notificationEmail?: unknown; emailNotificationsEnabled?: unknown; emailWeeklyEnabled?: unknown; emailAtsDueEnabled?: unknown; emailSurvivorDueEnabled?: unknown; emailCustomEnabled?: unknown; pushWeeklyEnabled?: unknown; pushAtsDueEnabled?: unknown; pushSurvivorDueEnabled?: unknown; pushCustomEnabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Your notification settings were incomplete." }, { status: 400 });
  }

  const email = typeof body.notificationEmail === "string"
    ? body.notificationEmail.trim().toLowerCase()
    : "";
  const preference = (value: unknown, current: boolean) => typeof value === "boolean" ? value : current;

  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("players")
    .update({
      notification_email: email || null,
      email_notifications_enabled: email ? preference(body.emailNotificationsEnabled, player.email_notifications_enabled) : false,
      email_weekly_enabled: preference(body.emailWeeklyEnabled, player.email_weekly_enabled),
      email_ats_due_enabled: preference(body.emailAtsDueEnabled, player.email_ats_due_enabled),
      email_survivor_due_enabled: preference(body.emailSurvivorDueEnabled, player.email_survivor_due_enabled),
      email_custom_enabled: preference(body.emailCustomEnabled, player.email_custom_enabled),
      push_weekly_enabled: preference(body.pushWeeklyEnabled, player.push_weekly_enabled),
      push_ats_due_enabled: preference(body.pushAtsDueEnabled, player.push_ats_due_enabled),
      push_survivor_due_enabled: preference(body.pushSurvivorDueEnabled, player.push_survivor_due_enabled),
      push_custom_enabled: preference(body.pushCustomEnabled, player.push_custom_enabled),
      notification_preferences_updated_at: new Date().toISOString(),
    })
    .eq("id", player.id);

  if (error) {
    return NextResponse.json({ error: "Your notification settings could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ message: "Notification settings saved." });
}
