import { NextRequest, NextResponse } from "next/server";
import {
  derivePlayerAuthPassword,
  PLAYER_AUTH_CREDENTIAL_VERSION,
} from "@/lib/player-auth-credential";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { playerAuthPepper } from "@/lib/player-auth-config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  const commissioner = commissionerResult.player;

  let confirmation = "";
  try {
    const body = await request.json();
    confirmation = typeof body?.confirmation === "string" ? body.confirmation : "";
  } catch {
    return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });
  }

  if (confirmation !== "HARDEN PLAYER SIGN-INS") {
    return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });
  }

  const authPepper = playerAuthPepper();
  if (!authPepper) {
    return NextResponse.json(
      { error: "Player sign-in security is not configured." },
      { status: 503 },
    );
  }

  const { data: players, error: playersError } = await supabaseAdmin
    .from("players")
    .select("id, login_pin, auth_user_id")
    .not("auth_user_id", "is", null)
    .order("created_at");

  if (playersError) {
    return NextResponse.json(
      { error: "Player sign-in accounts could not be loaded." },
      { status: 503 },
    );
  }

  const failures: string[] = [];
  let hardened = 0;

  for (const player of players ?? []) {
    const loginPin = player.login_pin ?? "";
    if (!player.auth_user_id || !/^\d{4}$/.test(loginPin)) {
      failures.push(player.id);
      continue;
    }

    const { data: account, error: accountError } = await supabaseAdmin.auth.admin.getUserById(
      player.auth_user_id,
    );
    if (accountError || !account.user) {
      failures.push(player.id);
      continue;
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      player.auth_user_id,
      {
        password: derivePlayerAuthPassword(loginPin, authPepper),
        app_metadata: {
          ...(account.user.app_metadata ?? {}),
          pickem_credential_version: PLAYER_AUTH_CREDENTIAL_VERSION,
        },
      },
    );

    if (updateError) failures.push(player.id);
    else hardened += 1;
  }

  const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
    actor_player_id: commissioner.id,
    action: failures.length ? "player_auth_hardening_incomplete" : "player_auth_hardened",
    entity_type: "security_control",
    details: {
      credential_version: PLAYER_AUTH_CREDENTIAL_VERSION,
      accounts_hardened: hardened,
      accounts_failed: failures.length,
    },
  });

  if (auditError) {
    return NextResponse.json(
      { error: "Sign-in accounts were updated, but the audit receipt could not be saved." },
      { status: 503 },
    );
  }

  if (failures.length) {
    return NextResponse.json(
      {
        error: `${failures.length} player sign-in account${failures.length === 1 ? "" : "s"} could not be hardened. Re-run this safe operation.`,
        hardened,
        failed: failures.length,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    message: `${hardened} player sign-in account${hardened === 1 ? "" : "s"} now use protected credentials.`,
    hardened,
    failed: 0,
  });
}
