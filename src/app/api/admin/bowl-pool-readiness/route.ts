import { NextRequest, NextResponse } from "next/server";
import { currentSeasonYear } from "@/lib/season";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { assessBowlPoolIntegrity, countMissingBowlTeamSlots } from "@/lib/bowl-pool-integrity.js";
import { assessBowlPoolSettlement } from "@/lib/bowl-pool-reconciliation.js";

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  const { data: season, error } = await supabaseAdmin.from("bowl_pool_seasons").select("id, season_year, player_visible_at, first_kickoff_at").eq("season_year", currentSeasonYear()).maybeSingle();
  if (error || !season) return NextResponse.json({ error: "Bowl Pool season is not configured." }, { status: 404 });
  const [
    { data: games, error: gamesError },
    { data: heartbeats, error: heartbeatError },
    { data: entries, error: entriesError },
  ] = await Promise.all([
    supabaseAdmin.from("bowl_pool_games").select("id, kickoff_at, order_index, away_team_id, home_team_id, status").eq("season_id", season.id).order("kickoff_at"),
    supabaseAdmin.from("automation_worker_heartbeats").select("job_name, last_status, last_succeeded_at, updated_at").in("job_name", ["schedule_refresh", "line_locks", "scores"]),
    supabaseAdmin.from("bowl_pool_entries").select("id,status").eq("season_id", season.id),
  ]);
  if (gamesError || entriesError) return NextResponse.json({ error: "Bowl Pool readiness could not be read." }, { status: 500 });

  const gameIds = (games ?? []).map((game) => game.id);
  const entryIds = (entries ?? []).map((entry) => entry.id);
  const emptyRead = { data: [], error: null };
  const [
    { data: lines, error: linesError },
    { data: picks, error: picksError },
    { data: results, error: resultsError },
    { count: openScheduleChanges, error: changesError },
  ] = await Promise.all([
    gameIds.length ? supabaseAdmin.from("bowl_pool_game_lines").select("game_id, source, locked_at").in("game_id", gameIds) : Promise.resolve(emptyRead),
    entryIds.length ? supabaseAdmin.from("bowl_pool_picks").select("entry_id,game_id,result").in("entry_id", entryIds) : Promise.resolve(emptyRead),
    gameIds.length ? supabaseAdmin.from("bowl_pool_game_results").select("entry_id,game_id,result").in("game_id", gameIds) : Promise.resolve(emptyRead),
    gameIds.length ? supabaseAdmin.from("bowl_pool_schedule_changes").select("id", { count: "exact", head: true }).is("reviewed_at", null).in("game_id", gameIds) : Promise.resolve({ count: 0, error: null }),
  ]);
  if (linesError || picksError || resultsError || changesError) {
    return NextResponse.json({ error: "Bowl Pool readiness could not be read." }, { status: 500 });
  }
  const future = (games ?? []).filter((game) => new Date(game.kickoff_at).getTime() > Date.now());
  const missingTeams = countMissingBowlTeamSlots(games ?? []);
  const lockedGames = (games ?? []).filter((game) => game.status !== "scheduled").length;
  const beforeFirstKickoff = !season.first_kickoff_at || new Date() < new Date(season.first_kickoff_at);
  const assessedIntegrity = assessBowlPoolIntegrity(games ?? [], lines ?? []);
  const urgentLineCutoff = Date.now() + 24 * 60 * 60 * 1000;
  const missingLineBeforeKickoff = (games ?? []).filter((game) => game.status === "scheduled" && new Date(game.kickoff_at).getTime() <= urgentLineCutoff && !lines?.some((line) => line.game_id === game.id)).length;
  // Team assignments are intentionally TBD during preseason setup. Keep the
  // readiness panel useful without raising a production incident before the
  // first kickoff; ordering and status still remain visible and are repaired
  // by migrations when the schedule changes.
  const integrity = beforeFirstKickoff && missingTeams > 0
    ? { ...assessedIntegrity, healthy: assessedIntegrity.problems.every((problem) => problem.includes("missing a team")), problems: assessedIntegrity.problems.filter((problem) => !problem.includes("missing a team")) }
    : assessedIntegrity;
  const settlement = assessBowlPoolSettlement({ games: (games ?? []).filter((game) => game.status === "final"), entries: entries ?? [], picks: picks ?? [], results: results ?? [], lines: lines ?? [] });
  return NextResponse.json({ checkedAt: new Date().toISOString(), seasonYear: season.season_year, playerVisibleAt: season.player_visible_at, firstKickoffAt: season.first_kickoff_at, games: games?.length ?? 0, missingTeams, missingLines: integrity.missingLines, missingLineBeforeKickoff, lineSources: [...new Set((lines ?? []).map((line) => line.source).filter(Boolean))], nextKickoffAt: future[0]?.kickoff_at ?? null, openScheduleChanges: openScheduleChanges ?? 0, cronHealth: heartbeatError ? "unavailable" : ((heartbeats ?? []).every((row) => row.last_status === "success" || row.last_status === "skipped") ? "healthy" : "attention"), lockedGames, integrity: { healthy: integrity.healthy && missingLineBeforeKickoff === 0, problems: [...integrity.problems, ...(missingLineBeforeKickoff ? [`${missingLineBeforeKickoff} Bowl Pool game(s) within 24 hours are missing a spread.`] : [])] }, settlement: { healthy: settlement.healthy, problems: settlement.problems } });
}
