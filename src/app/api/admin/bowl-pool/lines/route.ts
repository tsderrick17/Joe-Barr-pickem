import { NextRequest, NextResponse } from "next/server";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";
import { readJsonObject } from "@/lib/request-validation";
import { parseBowlLine } from "@/lib/request-bodies";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { seasonYearAt } from "@/lib/season";
import { bowlManualLineProblem } from "@/lib/bowl-commissioner-input.js";

/** A game shows here from the evening before its line locks: earlier than that the provider feeds are still expected to supply the line. */
const LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
/** A game that went final with no line cannot be graded, so it shows whatever its date. A postponed or cancelled game has nothing to grade. */
const LINE_GAME_STATUSES = ["scheduled", "live", "final"];

export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  const { data: season } = await supabaseAdmin.from("bowl_pool_seasons").select("id").eq("season_year", seasonYearAt()).maybeSingle();
  if (!season) return NextResponse.json({ games: [] });
  const { data: games, error } = await supabaseAdmin.from("bowl_pool_games").select("id, bowl_name, kickoff_at, line_lock_at, status, away_team_id, home_team_id").eq("season_id", season.id).in("status", LINE_GAME_STATUSES).not("away_team_id", "is", null).not("home_team_id", "is", null).order("kickoff_at");
  if (error || !games) return NextResponse.json({ error: "Bowl Pool lines could not be loaded." }, { status: 500 });
  const { data: lines, error: linesError } = games.length ? await supabaseAdmin.from("bowl_pool_game_lines").select("game_id").in("game_id", games.map((game) => game.id)) : { data: [], error: null };
  if (linesError) return NextResponse.json({ error: "Bowl Pool lines could not be loaded." }, { status: 500 });
  const withLine = new Set((lines ?? []).map((line) => line.game_id));
  const due = games.filter((game) => !withLine.has(game.id) && (game.status === "final" || new Date(game.line_lock_at).getTime() <= Date.now() + LOOKAHEAD_MS));
  const teamIds = [...new Set(due.flatMap((game) => [game.away_team_id, game.home_team_id]).filter((id): id is string => Boolean(id)))];
  const { data: teams, error: teamError } = teamIds.length ? await supabaseAdmin.from("bowl_pool_teams").select("id, display_name").in("id", teamIds) : { data: [], error: null };
  if (teamError) return NextResponse.json({ error: "Bowl Pool team details could not be loaded." }, { status: 500 });
  const names = new Map((teams ?? []).map((team) => [team.id, team.display_name]));
  return NextResponse.json({ games: due.map((game) => ({ id: game.id, bowlName: game.bowl_name, kickoffAt: game.kickoff_at, lineLockAt: game.line_lock_at, status: game.status, away: { id: game.away_team_id, name: names.get(game.away_team_id ?? "") ?? "Team TBD" }, home: { id: game.home_team_id, name: names.get(game.home_team_id ?? "") ?? "Team TBD" } })) });
}

/**
 * The Commissioner's hand-entered line, for a game the provider feeds gave none: with no line a pick cannot be graded and the Bowl health check goes red.
 * It is the official line at once (locked now, flagged as a manual override), and only a game with no line at all can take one: a line a feed supplied,
 * preliminary or locked, is never replaced from here.
 */
export async function POST(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  const input = await readJsonObject(request);
  const body = input ? parseBowlLine(input) : null;
  if (!body) return NextResponse.json({ error: "Choose a game, its favorite and the spread." }, { status: 400 });
  const { data: game, error: gameError } = await supabaseAdmin.from("bowl_pool_games").select("id, bowl_name, status, away_team_id, home_team_id").eq("id", body.gameId).maybeSingle();
  if (gameError) return NextResponse.json({ error: "The game could not be loaded." }, { status: 500 });
  if (!game) return NextResponse.json({ error: "That Bowl Pool game does not exist." }, { status: 404 });
  if (!LINE_GAME_STATUSES.includes(game.status)) return NextResponse.json({ error: "A postponed or cancelled game has no line to set." }, { status: 400 });
  if (!game.away_team_id || !game.home_team_id) return NextResponse.json({ error: "Both teams must be known before a line can be set." }, { status: 400 });
  const problem = bowlManualLineProblem(body, game);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const now = new Date().toISOString();
  const { error: lineError } = await supabaseAdmin.from("bowl_pool_game_lines").insert({ game_id: game.id, favorite_team_id: body.favoriteTeamId, source_spread: body.spread, locked_spread: body.spread, source: "Commissioner", source_captured_at: now, locked_at: now, manual_override: true });
  if (lineError?.code === "23505") return NextResponse.json({ error: "That game already has a line." }, { status: 409 });
  if (lineError) return NextResponse.json({ error: "The line could not be saved." }, { status: 500 });
  const { error: historyError } = await supabaseAdmin.from("bowl_pool_spread_history").insert({ game_id: game.id, favorite_team_id: body.favoriteTeamId, source_spread: body.spread, pool_spread: body.spread, source: "Commissioner", captured_at: now });
  if (historyError) console.error("A Bowl Pool line-history snapshot could not be saved.", { gameId: game.id });
  return NextResponse.json({ message: `${game.bowl_name}: line set to ${body.spread}. It is official now.` });
}
