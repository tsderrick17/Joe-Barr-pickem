import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function requireCommissioner(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return null;

  const authClient = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id, active, is_commissioner")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return player?.active && player.is_commissioner ? player : null;
}

export async function POST(request: NextRequest) {
  const commissioner = await requireCommissioner(request);
  if (!commissioner) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });

  let body: { gameId?: string; status?: "postponed" | "cancelled" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The disruption record was incomplete." }, { status: 400 });
  }
  if (!body.gameId || !["postponed", "cancelled"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Choose a game and a valid disruption status." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("record_game_disruption", {
    target_game_id: body.gameId,
    disruption_status: body.status,
    actor_player_id: commissioner.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const result = data?.[0] as { ats_voided?: number; survivor_voided?: number } | undefined;
  return NextResponse.json({
    message: `${body.status === "cancelled" ? "Cancellation" : "Postponement"} recorded. ${result?.ats_voided ?? 0} ATS and ${result?.survivor_voided ?? 0} Survivor pick${(result?.survivor_voided ?? 0) === 1 ? "" : "s"} voided.`,
  });
}
