import { NextRequest, NextResponse } from "next/server";
import { accessDenied } from "@/lib/access-response";
import { buildAllTimeStats } from "@/lib/all-time-stats.js";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { weeklyStreaks } from "@/lib/group-stats.js";
import { readAllPages } from "@/lib/read-all-pages";
import { trophyRoomOpen } from "@/lib/trophy-room-access.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * The Trophy Room: every season's champions, and every player's all-time batting-average record with their streaks. Read-only, and built
 * only from graded picks, so it can never show anyone's unstarted pick. For now it is the Commissioner's alone; a player gets 404 until an
 * opening for players is scheduled (see src/lib/trophy-room-access.js).
 */
export async function GET(request: NextRequest) {
  const access = await authenticateActivePlayer(request);
  if (!access.ok) return accessDenied(access);
  if (!trophyRoomOpen(Date.now(), access.player.is_commissioner)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [players, seasons, periods, survivorEntries, championships, bowlSeasons, bowlChampionships, games, lines, picks, weekPicks] = await Promise.all([
    supabaseAdmin.from("players").select("id, first_name"),
    supabaseAdmin.from("seasons").select("id, year"),
    supabaseAdmin.from("scoring_periods").select("id, season_id, display_order, period_type, status, max_picks"),
    supabaseAdmin.from("survivor_entries").select("player_id, eliminated_scoring_period_id"),
    supabaseAdmin.from("pool_championships").select("season_year, pool, player_id"),
    supabaseAdmin.from("bowl_pool_seasons").select("id, season_year"),
    supabaseAdmin.from("bowl_pool_championships").select("season_id, player_id"),
    readAllPages((from, to) => supabaseAdmin.from("games").select("id, kickoff_at").order("id").range(from, to)),
    readAllPages((from, to) => supabaseAdmin.from("game_lines").select("game_id, favorite_team_id").order("game_id").range(from, to)),
    readAllPages((from, to) => supabaseAdmin.from("picks").select("id, player_id, game_id, scoring_period_id, selected_team_id, result").in("result", ["win", "loss"]).order("id").range(from, to)),
    // the streaks also need the voided and unsettled picks, which leave a week out
    readAllPages((from, to) => supabaseAdmin.from("picks").select("id, player_id, scoring_period_id, result").order("id").range(from, to)),
  ]);

  const failed = [players, seasons, periods, survivorEntries, championships, bowlSeasons, bowlChampionships, games, lines, picks, weekPicks].some((read) => read.error);
  if (failed) return NextResponse.json({ error: "The Trophy Room could not be loaded." }, { status: 500 });

  const bowlYearBySeason = new Map((bowlSeasons.data ?? []).map((season) => [season.id, season.season_year]));
  const stats = buildAllTimeStats({
    players: players.data ?? [],
    seasons: seasons.data ?? [],
    periods: periods.data ?? [],
    games: games.data ?? [],
    lines: lines.data ?? [],
    picks: picks.data ?? [],
    survivorEntries: survivorEntries.data ?? [],
    championships: championships.data ?? [],
    bowlChampionships: (bowlChampionships.data ?? []).flatMap((record) => {
      const year = bowlYearBySeason.get(record.season_id);
      return year === undefined ? [] : [{ season_year: year, player_id: record.player_id }];
    }),
  });
  const streaks = weeklyStreaks({ seasons: seasons.data ?? [], periods: periods.data ?? [], picks: weekPicks.data ?? [] });
  return NextResponse.json({ ...stats, players: stats.players.map((row: { playerId: string }) => ({ ...row, streaks: streaks.get(row.playerId) ?? null })) });
}
