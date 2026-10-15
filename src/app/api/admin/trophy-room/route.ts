import { NextRequest, NextResponse } from "next/server";
import { accessDenied } from "@/lib/access-response";
import { buildAllTimeStats } from "@/lib/all-time-stats.js";
import { readAllPages } from "@/lib/read-all-pages";
import { commissionerAccess } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** The Trophy Room (Commissioner only): every season's champions and the all-time batting-average table. Read-only. */
export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);

  const [players, seasons, periods, championships, bowlSeasons, bowlChampionships, games, lines, picks] = await Promise.all([
    supabaseAdmin.from("players").select("id, first_name"),
    supabaseAdmin.from("seasons").select("id, year"),
    supabaseAdmin.from("scoring_periods").select("id, season_id"),
    supabaseAdmin.from("pool_championships").select("season_year, pool, player_id"),
    supabaseAdmin.from("bowl_pool_seasons").select("id, season_year"),
    supabaseAdmin.from("bowl_pool_championships").select("season_id, player_id"),
    readAllPages((from, to) => supabaseAdmin.from("games").select("id, kickoff_at").order("id").range(from, to)),
    readAllPages((from, to) => supabaseAdmin.from("game_lines").select("game_id, favorite_team_id").order("game_id").range(from, to)),
    readAllPages((from, to) => supabaseAdmin.from("picks").select("id, player_id, game_id, scoring_period_id, selected_team_id, result").in("result", ["win", "loss"]).order("id").range(from, to)),
  ]);

  const failed = [players, seasons, periods, championships, bowlSeasons, bowlChampionships, games, lines, picks].some((read) => read.error);
  if (failed) return NextResponse.json({ error: "The Trophy Room could not be loaded." }, { status: 500 });

  const bowlYearBySeason = new Map((bowlSeasons.data ?? []).map((season) => [season.id, season.season_year]));
  const stats = buildAllTimeStats({
    players: players.data ?? [],
    seasons: seasons.data ?? [],
    periods: periods.data ?? [],
    games: games.data ?? [],
    lines: lines.data ?? [],
    picks: picks.data ?? [],
    championships: championships.data ?? [],
    bowlChampionships: (bowlChampionships.data ?? []).flatMap((record) => {
      const year = bowlYearBySeason.get(record.season_id);
      return year === undefined ? [] : [{ season_year: year, player_id: record.player_id }];
    }),
  });
  return NextResponse.json(stats);
}
