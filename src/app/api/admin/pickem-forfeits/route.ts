import { NextRequest, NextResponse } from "next/server";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";
import { idValue, readJsonObject } from "@/lib/request-validation";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Commissioner-only: reinstate a player who forfeited the Pick'em playoffs (a mis-click, or a change of heart the pool agrees to).
 * It lets them pick again on games that have not started. Picks voided by the forfeit are not restored. Audited by the database function.
 */
export async function POST(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);

  const input = await readJsonObject(request);
  const playerId = idValue(input?.playerId);
  if (!playerId) return NextResponse.json({ error: "Choose the player to reinstate." }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc("reverse_pickem_forfeit", { target_player_id: playerId, acting_player_id: commissionerResult.player.id });
  if (error) return NextResponse.json({ error: "The forfeit could not be reversed. Nothing changed; please try again." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "That player has no active forfeit." }, { status: 404 });
  return NextResponse.json({ reinstated: true });
}
