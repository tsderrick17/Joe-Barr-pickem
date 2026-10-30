import { readJsonObject } from "@/lib/request-validation";
import { parseNewPlayer } from "@/lib/request-bodies";
import { NextRequest, NextResponse } from "next/server";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { derivePlayerAuthPassword, PLAYER_AUTH_CREDENTIAL_VERSION, playerAuthEmail } from "@/lib/player-auth-credential";
import { playerAuthPepper } from "@/lib/player-auth-config";
import { loadForfeitedPlayerIds } from "@/lib/playoff-eligibility";
import { currentSeasonYear } from "@/lib/season";
import { deviceSummary, visitWindowStart } from "@/lib/player-presence.js";

export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);

  const { data: players, error } = await supabaseAdmin
    .from("players")
    .select(
      "id, first_name, login_pin, active, is_commissioner, created_at, last_active_at, notification_email, email_notifications_enabled, last_device, last_browser, last_via_app, app_seen_at",
    )
    .order("first_name");

  if (error) {
    return NextResponse.json(
      { error: "The player list could not be loaded." },
      { status: 500 },
    );
  }

  const { data: season, error: seasonError } = await supabaseAdmin.from("seasons").select("id").eq("year", currentSeasonYear()).maybeSingle();
  let forfeited = new Set<string>();
  if (season) {
    try { forfeited = await loadForfeitedPlayerIds(season.id); } catch { return NextResponse.json({ error: "The player list could not be loaded." }, { status: 500 }); }
  } else if (seasonError) {
    return NextResponse.json({ error: "The player list could not be loaded." }, { status: 500 });
  }

  // Which players have a phone or computer that gets notifications, and how many days each visited in the last week. Both are extras on
  // the list: if either cannot be read the list still loads, and that column says nothing instead of a wrong zero.
  const [subscriptions, visits] = await Promise.all([
    supabaseAdmin.from("push_subscriptions").select("player_id"),
    supabaseAdmin.from("player_visit_days").select("player_id").gte("day", visitWindowStart(Date.now())),
  ]);
  const withNotifications = new Set((subscriptions.data ?? []).map((row) => row.player_id));
  const visitDays = new Map<string, number>();
  for (const row of visits.data ?? []) visitDays.set(row.player_id, (visitDays.get(row.player_id) ?? 0) + 1);

  return NextResponse.json({
    players: (players ?? []).map((player) => ({
      id: player.id,
      firstName: player.first_name,
      loginPin: player.login_pin,
      active: player.active,
      isCommissioner: player.is_commissioner,
      forfeited: forfeited.has(player.id),
      emailNotificationsEnabled: Boolean(player.email_notifications_enabled && player.notification_email?.trim()),
      createdAt: player.created_at,
      lastActiveAt: player.last_active_at,
      hasApp: player.app_seen_at !== null,
      notificationsOn: subscriptions.error ? null : withNotifications.has(player.id),
      visitDays: visits.error ? null : visitDays.get(player.id) ?? 0,
      lastSeenOn: deviceSummary({ device: player.last_device, browser: player.last_browser, viaApp: player.last_via_app }),
    })),
  });
}

export async function POST(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  const commissioner = commissionerResult.player;

  const input = await readJsonObject(request);
  if (!input) {
    return NextResponse.json(
      { error: "The player information was not valid." },
      { status: 400 },
    );
  }
  const { firstName, pin } = parseNewPlayer(input);

  if (
    firstName.length < 1 ||
    firstName.length > 40 ||
    !/^[A-Za-z][A-Za-z'. -]*$/.test(firstName)
  ) {
    return NextResponse.json(
      { error: "Enter the name as it should appear in the Standings." },
      { status: 400 },
    );
  }

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "The PIN must contain exactly four numbers." },
      { status: 400 },
    );
  }

  const { data: existingPlayer } = await supabaseAdmin
    .from("players")
    .select("id")
    .ilike("first_name", firstName)
    .maybeSingle();

  if (existingPlayer) {
    return NextResponse.json(
      { error: `${firstName} is already in the player list.` },
      { status: 409 },
    );
  }

  const email = playerAuthEmail(pin);
  const authPepper = playerAuthPepper();
  if (!authPepper) {
    return NextResponse.json(
      { error: "Player sign-in security is not configured." },
      { status: 503 },
    );
  }
  const password = derivePlayerAuthPassword(pin, authPepper);

  const {
    data: createdAccount,
    error: accountError,
  } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { pickem_credential_version: PLAYER_AUTH_CREDENTIAL_VERSION },
  });

  if (accountError || !createdAccount.user) {
    return NextResponse.json(
      {
        error:
          "That PIN is already being used. Choose a different four-digit PIN.",
      },
      { status: 409 },
    );
  }

  const authUserId = createdAccount.user.id;

  const { data: newPlayer, error: playerError } =
    await supabaseAdmin
      .from("players")
      .insert({
        first_name: firstName,
        login_pin: pin,
        auth_user_id: authUserId,
        is_commissioner: false,
        active: true,
      })
      .select(
        "id, first_name, login_pin, active, is_commissioner",
      )
      .single();

  if (playerError || !newPlayer) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    return NextResponse.json(
      { error: "The player could not be created." },
      { status: 500 },
    );
  }

  const { error: auditError } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      actor_player_id: commissioner.id,
      action: "player_created",
      entity_type: "player",
      entity_id: newPlayer.id,
      details: {
        first_name: firstName,
      },
    });

  if (auditError) {
    await supabaseAdmin
      .from("players")
      .delete()
      .eq("id", newPlayer.id);

    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    return NextResponse.json(
      {
        error:
          "The player could not be created because the action was not recorded.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      message: `${firstName} was added successfully.`,
      player: {
        id: newPlayer.id,
        firstName: newPlayer.first_name,
        loginPin: newPlayer.login_pin,
        active: newPlayer.active,
        isCommissioner: newPlayer.is_commissioner,
      },
    },
    { status: 201 },
  );
}
