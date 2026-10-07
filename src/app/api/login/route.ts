import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServerKey } from "@/lib/supabase-admin";
import { recordPlayerActivity } from "@/lib/player-activity";
import { authenticatePlayerPin } from "@/lib/player-pin-authentication";
import { playerAuthPepper } from "@/lib/player-auth-config";

export const runtime = "nodejs";

function fingerprint(value: string, context: string) {
  return createHmac("sha256", supabaseServerKey).update(`${context}:${value}`).digest("hex");
}

function requestSource(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function response(
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

async function sourceCooldownSeconds(sourceFingerprint: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "pin_login_cooldown_seconds",
    { attempt_source_fingerprint: sourceFingerprint },
  );
  if (error) throw new Error("PIN cooldown could not be checked.");
  return Math.max(0, Number(data ?? 0));
}

function cooldownResponse(retryAfter: number) {
  return response(
    { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
    429,
    { "Retry-After": String(Math.max(1, Math.ceil(retryAfter))) },
  );
}

export async function POST(request: NextRequest) {
  let pin = "";
  try {
    const body = await request.json();
    pin = typeof body?.pin === "string" ? body.pin : "";
  } catch {
    return response({ error: "Enter a four-digit PIN." }, 400);
  }

  if (!/^\d{4}$/.test(pin)) return response({ error: "Enter a four-digit PIN." }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authPepper = playerAuthPepper();
  if (!url || !publishableKey || !authPepper) return response({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);

  let sourceFingerprint: string;
  let pinFingerprint: string;
  try {
    sourceFingerprint = fingerprint(requestSource(request), "pin-login-source");
    pinFingerprint = fingerprint(pin, "pin-login-value");
  } catch {
    return response({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);
  }

  try {
    const retryAfter = await sourceCooldownSeconds(sourceFingerprint);
    if (retryAfter > 0) return cooldownResponse(retryAfter);
  } catch {
    return response({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);
  }

  const auth = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { "sb-forwarded-for": requestSource(request) } },
  });
  // Existing accounts used the four-digit PIN as part of their Auth password.
  // The shared transition accepts that credential only long enough to rotate
  // it, then returns a newly authenticated server-derived session.
  const authentication = await authenticatePlayerPin({
    pin,
    serverSecret: authPepper,
    signIn: (credentials) => auth.auth.signInWithPassword(credentials),
    updateAccount: (userId, attributes) => supabaseAdmin.auth.admin.updateUserById(userId, attributes),
  });
  if (authentication.rotationFailed) {
    return response({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);
  }
  const { data, error } = authentication.auth;

  if (error || !data.session || !data.user) {
    const { error: recordError } = await supabaseAdmin.rpc("record_failed_pin_login", {
      attempt_source_fingerprint: sourceFingerprint,
      attempt_pin_fingerprint: pinFingerprint,
    });
    if (recordError) return response({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);
    try {
      const retryAfter = await sourceCooldownSeconds(sourceFingerprint);
      if (retryAfter > 0) return cooldownResponse(retryAfter);
    } catch {
      return response({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);
    }
    return response({ error: "That PIN was not recognized. Please try again." }, 401);
  }

  // A successful player sign-in clears prior failures from the same source so
  // a shared household or office cannot create a false security incident.
  const { error: clearError } = await supabaseAdmin.rpc("clear_failed_pin_logins", { attempt_source_fingerprint: sourceFingerprint });
  // Never block a correct PIN over bookkeeping, but make the miss visible:
  // uncleared failures could otherwise trigger a false cooldown for this source.
  if (clearError) console.error("Prior failed PIN attempts could not be cleared after a successful sign-in.");
  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (player) await recordPlayerActivity(player.id);

  return response({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
}
