import { readJsonObject } from "@/lib/request-validation";
import { parseGameDisruption } from "@/lib/request-bodies";
import { NextRequest, NextResponse } from "next/server";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  const commissioner = commissionerResult.player;

  const input = await readJsonObject(request);
  if (!input) return NextResponse.json({ error: "The disruption record was incomplete." }, { status: 400 });
  const body = parseGameDisruption(input);
  if (!body) return NextResponse.json({ error: "Choose a game and a valid disruption status." }, { status: 400 });
  const { gameId, status } = body;

  const { data, error } = await supabaseAdmin.rpc("record_game_disruption", {
    target_game_id: gameId,
    disruption_status: status,
    actor_player_id: commissioner.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const result = data?.[0] as { ats_voided?: number; survivor_voided?: number } | undefined;
  return NextResponse.json({
    message: `${body.status === "no_contest" ? "No contest" : body.status === "cancelled" ? "Cancellation" : "Postponement"} recorded. ${result?.ats_voided ?? 0} ATS and ${result?.survivor_voided ?? 0} Survivor pick${(result?.survivor_voided ?? 0) === 1 ? "" : "s"} voided.`,
  });
}
