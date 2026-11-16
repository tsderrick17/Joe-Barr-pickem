import { NextRequest, NextResponse } from "next/server";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { playerAccessErrorMessage } from "@/lib/player-access-result";
import { readAllPages } from "@/lib/read-all-pages";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { weeksThrough, winTotals } from "@/lib/board-totals.js";

/**
 * Each player's wins added up through the end of one week: what the Big Board shows when a player looks back at that week, so the board
 * is the pool as it stood then rather than only that week's wins. Graded results are public (the Standings show them), so this reads
 * nothing a player cannot already see; it never touches an unstarted pick (only picks already graded a win are read).
 */
export async function GET(request: NextRequest) {
  const access = await authenticateActivePlayer(request);
  if (!access.ok) return NextResponse.json({ error: playerAccessErrorMessage(access.code), code: access.code }, { status: access.status });

  const weekId = new URL(request.url).searchParams.get("week");
  if (!weekId) return NextResponse.json({ error: "You must choose a week." }, { status: 400 });

  const chosen = await supabaseAdmin.from("scoring_periods").select("id, season_id, display_order, period_type").eq("id", weekId).maybeSingle();
  if (chosen.error) return NextResponse.json({ error: "That week could not be found." }, { status: 404 });
  if (!chosen.data || chosen.data.period_type !== "regular") return NextResponse.json({ error: "That week could not be found." }, { status: 404 });

  const periods = await supabaseAdmin.from("scoring_periods").select("id, display_order, period_type").eq("season_id", chosen.data.season_id).eq("period_type", "regular").lte("display_order", chosen.data.display_order);
  if (periods.error || !periods.data) return NextResponse.json({ error: "The weeks could not be loaded." }, { status: 503 });
  const ids = weeksThrough(chosen.data, periods.data);

  const wins = await readAllPages((from, to) => supabaseAdmin.from("picks").select("player_id, result").in("scoring_period_id", ids).eq("result", "win").order("id").range(from, to));
  if (wins.error || !wins.data) {
    console.error("Big Board totals query failed.", { code: wins.error?.code });
    return NextResponse.json({ error: "The totals could not be loaded." }, { status: 503 });
  }
  return NextResponse.json({ weekId, totals: winTotals(wins.data) }, { headers: { "Cache-Control": "private, no-store" } });
}
