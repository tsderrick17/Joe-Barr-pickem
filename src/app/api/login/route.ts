import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { recordPlayerActivity } from "@/lib/player-activity";

export const runtime = "nodejs";

function fingerprint(value: string, context: string) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("PIN-login protection is not configured.");
  return createHmac("sha256", secret).update(`${context}:${value}`).digest("hex");
}

function requestSource(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
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
  if (!url || !publishableKey) return response({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);

  let sourceFingerprint: string;
  let pinFingerprint: string;
  try {
    sourceFingerprint = fingerprint(requestSource(request), "pin-login-source");
    pinFingerprint = fingerprint(pin, "pin-login-value");
  } catch {
    return response({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);
  }

  const auth = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { "sb-forwarded-for": requestSource(request) } },
  });
  const { data, error } = await auth.auth.signInWithPassword({
    email: `pin-${pin}@pickemjb.app`,
    password: `pickem-${pin}`,
  });

  if (error || !data.session) {
    const { error: recordError } = await supabaseAdmin.rpc("record_failed_pin_login", {
      attempt_source_fingerprint: sourceFingerprint,
      attempt_pin_fingerprint: pinFingerprint,
    });
    if (recordError) return response({ error: "Sign-in is temporarily unavailable. Try again shortly." }, 503);
    return response({ error: "That PIN was not recognized. Please try again." }, 401);
  }

  // A successful player sign-in clears prior failures from the same source so
  // a shared household or office cannot create a false security incident.
  await supabaseAdmin.rpc("clear_failed_pin_logins", { attempt_source_fingerprint: sourceFingerprint });
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
