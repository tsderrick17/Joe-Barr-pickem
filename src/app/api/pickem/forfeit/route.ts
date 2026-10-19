import { NextRequest, NextResponse } from "next/server";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { refuseWhenSeasonClosed } from "@/lib/off-season-gate";
import { playerAccessErrorMessage } from "@/lib/player-access-result";
import { readJsonObject } from "@/lib/request-validation";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * A player forfeits the Pick'em playoffs. It opens with the first playoff round, is final for the player (only the Commissioner can
 * reverse it), voids their picks on games that have not started, and keeps everything on games that have. The body must say the player
 * understood it can't be undone, which the page asks for with three separate clicks. The database function does the work atomically.
 */
export async function POST(request: NextRequest) {
  const input = await readJsonObject(request);
  if (input?.understood !== true) {
    return NextResponse.json({ error: "Please confirm that you understand this cannot be undone." }, { status: 400 });
  }

  const access = await authenticateActivePlayer(request);
  if (!access.ok) return NextResponse.json({ error: playerAccessErrorMessage(access.code), code: access.code }, { status: access.status });
  const closed = await refuseWhenSeasonClosed();
  if (closed) return closed;

  const { data, error } = await supabaseAdmin.rpc("forfeit_pickem_season", { target_player_id: access.player.id });
  if (error) {
    // The database refuses before the playoffs open and for an inactive player; everything else is an outage.
    const refused = /Forfeiting opens|Only an active player/.test(error.message);
    return NextResponse.json(
      { error: refused ? "Forfeiting opens when the first playoff round opens for picks." : "Your forfeit could not be saved. Nothing changed; please try again in a minute." },
      { status: refused ? 409 : 503 },
    );
  }
  const result = data?.[0];
  return NextResponse.json({ forfeited: true, picksVoided: result?.voided_picks ?? 0, alreadyForfeited: Boolean(result?.was_already_forfeited) });
}
