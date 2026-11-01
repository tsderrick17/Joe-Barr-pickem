import { readJsonObject } from "@/lib/request-validation";
import { parseVerifiedFinal } from "@/lib/request-bodies";
import { NextRequest, NextResponse } from "next/server";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Last resort for an NFL final the score provider can no longer supply: the database refuses it until the provider's three-day window has passed. */
export async function POST(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  const commissioner = commissionerResult.player;

  const input = await readJsonObject(request);
  if (!input) return NextResponse.json({ error: "The final score was incomplete." }, { status: 400 });
  const body = parseVerifiedFinal(input);
  if (!body) return NextResponse.json({ error: "Choose a game, enter both scores, and say where the final was verified." }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc("record_verified_final", {
    target_game_id: body.gameId,
    verified_away_score: body.awayScore,
    verified_home_score: body.homeScore,
    verification_source: body.source,
    actor_player_id: commissioner.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const result = data?.[0] as { ats_picks_graded?: number; survivor_picks_graded?: number } | undefined;
  const ats = result?.ats_picks_graded ?? 0;
  const survivor = result?.survivor_picks_graded ?? 0;
  return NextResponse.json({
    message: `Final saved: ${body.awayScore} to ${body.homeScore}. ${ats} ATS and ${survivor} Survivor pick${survivor === 1 ? "" : "s"} graded.`,
  });
}
