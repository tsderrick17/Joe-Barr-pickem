import { NextRequest, NextResponse } from "next/server";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { recordPlayerActivity } from "@/lib/player-activity";
import type { ProfileResponse, ProfileUpdateResponse } from "@/lib/api-contracts";

function accessFailure(access: { status: 401 | 403 | 500 | 503; code: string }) {
  const error = access.status === 401
    ? "Your sign-in session could not be verified."
    : access.status === 403
      ? "Your player profile is not active in this Pick'em."
      : access.status === 500
        ? "The server is missing required configuration."
        : "The player service could not be reached. Please try again.";
  return NextResponse.json({ error, code: access.code }, { status: access.status });
}

export async function GET(request: NextRequest) {
  const access = await authenticateActivePlayer(request, { includeProfilePreferences: true });
  if (!access.ok) return accessFailure(access);
  const player = access.player;

  const profile = {
    firstName: player.first_name,
    isCommissioner: player.is_commissioner,
    notificationEmail: player.notification_email ?? "",
    // Brevo can replace a free-address sender with its compliant delivery
    // address. Show recipients the address they will actually see, while the
    // private verified address remains server-only.
    senderEmail: process.env.BREVO_PUBLIC_SENDER_EMAIL ?? process.env.BREVO_SENDER_EMAIL ?? "",
    emailNotificationsEnabled: player.email_notifications_enabled,
    emailWeeklyEnabled: player.email_weekly_enabled,
    emailFinalLinesEnabled: player.email_final_lines_enabled,
    emailSundayFinalLinesEnabled: player.email_sunday_final_lines_enabled,
    emailEarlyLockEnabled: player.email_early_lock_enabled,
    emailPickDueEnabled: player.email_pick_due_enabled,
    emailPickDueSundayEarlyEnabled: player.email_pick_due_sunday_early_enabled,
    emailPickDueSundayAfternoonEnabled: player.email_pick_due_sunday_afternoon_enabled,
    emailPickDuePrimetimeEnabled: player.email_pick_due_primetime_enabled,
    emailWeeklyRecapEnabled: player.email_weekly_recap_enabled,
    emailPlayoffDayRecapEnabled: player.email_playoff_day_recap_enabled,
    emailPlayoffPublicRevealEnabled: player.email_playoff_public_reveal_enabled,
    emailAtsDueEnabled: player.email_ats_due_enabled,
    emailSurvivorDueEnabled: player.email_survivor_due_enabled,
    emailSundayEarlyRevealEnabled: player.email_sunday_early_reveal_enabled,
    emailSundayLateRevealEnabled: player.email_sunday_late_reveal_enabled,
    emailFeaturedWindowRevealEnabled: player.email_featured_window_reveal_enabled,
    emailCustomEnabled: player.email_custom_enabled,
    showSurvivorStandings: player.show_survivor_standings,
    showBowlCard: player.show_bowl_card,
    showPoolAction: player.show_pool_action,
    showPoolChat: player.show_pool_chat,
    hidePickemEliminatedRows: player.hide_pickem_eliminated_rows,
    hideSurvivorEliminatedRows: player.hide_survivor_eliminated_rows,
  } satisfies ProfileResponse;
  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest) {
  const access = await authenticateActivePlayer(request, { includeProfilePreferences: true });
  if (!access.ok) return accessFailure(access);
  const player = access.player;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Your notification settings were incomplete." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Your notification settings were incomplete." }, { status: 400 });
  }

  const hasEmailUpdate = typeof body.notificationEmail === "string";
  const email = hasEmailUpdate
    ? (body.notificationEmail as string).trim().toLowerCase()
    : player.notification_email ?? "";
  const preference = (value: unknown, current: boolean) => typeof value === "boolean" ? value : current;
  const everyGameDayLines = preference(body.emailFinalLinesEnabled, player.email_final_lines_enabled);
  // A player can still have the previous page open during deployment. If it
  // submits the former single switch, apply that choice to all three groups.
  const legacyPickDue = typeof body.emailPickDueEnabled === "boolean" ? body.emailPickDueEnabled : null;
  const sundayEarlyDue = preference(body.emailPickDueSundayEarlyEnabled, legacyPickDue ?? player.email_pick_due_sunday_early_enabled);
  const sundayAfternoonDue = preference(body.emailPickDueSundayAfternoonEnabled, legacyPickDue ?? player.email_pick_due_sunday_afternoon_enabled);
  const primetimeDue = preference(body.emailPickDuePrimetimeEnabled, legacyPickDue ?? player.email_pick_due_primetime_enabled);

  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("players")
    .update({
      notification_email: hasEmailUpdate ? email || null : player.notification_email,
      email_notifications_enabled: hasEmailUpdate ? (email ? preference(body.emailNotificationsEnabled, player.email_notifications_enabled) : false) : player.email_notifications_enabled,
      email_weekly_enabled: preference(body.emailWeeklyEnabled, player.email_weekly_enabled),
      email_final_lines_enabled: everyGameDayLines,
      email_sunday_final_lines_enabled: everyGameDayLines
        ? false
        : preference(body.emailSundayFinalLinesEnabled, player.email_sunday_final_lines_enabled),
      email_early_lock_enabled: preference(body.emailEarlyLockEnabled, player.email_early_lock_enabled),
      // Keep the historical roll-up synchronized for old receipts and a safe
      // rollback while each automatic occurrence uses its specific choice.
      email_pick_due_enabled: sundayEarlyDue || sundayAfternoonDue || primetimeDue,
      email_pick_due_sunday_early_enabled: sundayEarlyDue,
      email_pick_due_sunday_afternoon_enabled: sundayAfternoonDue,
      email_pick_due_primetime_enabled: primetimeDue,
      email_weekly_recap_enabled: preference(body.emailWeeklyRecapEnabled, player.email_weekly_recap_enabled),
      email_playoff_day_recap_enabled: preference(body.emailPlayoffDayRecapEnabled, player.email_playoff_day_recap_enabled),
      email_playoff_public_reveal_enabled: preference(body.emailPlayoffPublicRevealEnabled, player.email_playoff_public_reveal_enabled),
      email_ats_due_enabled: preference(body.emailAtsDueEnabled, player.email_ats_due_enabled),
      email_survivor_due_enabled: preference(body.emailSurvivorDueEnabled, player.email_survivor_due_enabled),
      email_sunday_early_reveal_enabled: preference(body.emailSundayEarlyRevealEnabled, player.email_sunday_early_reveal_enabled),
      email_sunday_late_reveal_enabled: preference(body.emailSundayLateRevealEnabled, player.email_sunday_late_reveal_enabled),
      email_featured_window_reveal_enabled: preference(body.emailFeaturedWindowRevealEnabled, player.email_featured_window_reveal_enabled),
      email_custom_enabled: true,
      show_survivor_standings: preference(body.showSurvivorStandings, player.show_survivor_standings),
      show_bowl_card: preference(body.showBowlCard, player.show_bowl_card),
      show_pool_action: preference(body.showPoolAction, player.show_pool_action),
      show_pool_chat: preference(body.showPoolChat, player.show_pool_chat),
      hide_pickem_eliminated_rows: preference(body.hidePickemEliminatedRows, player.hide_pickem_eliminated_rows),
      hide_survivor_eliminated_rows: preference(body.hideSurvivorEliminatedRows, player.hide_survivor_eliminated_rows),
      notification_preferences_updated_at: new Date().toISOString(),
    })
    .eq("id", player.id);

  if (error) {
    return NextResponse.json({ error: "Your notification settings could not be saved." }, { status: 500 });
  }

  await recordPlayerActivity(player.id);
  const result = { message: "Notification settings saved." } satisfies ProfileUpdateResponse;
  return NextResponse.json(result);
}
