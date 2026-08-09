import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fullSchedulePeriodAssignments, NFLVERSE_SCHEDULE_URL, parseNflverseRegularSeason } from "@/lib/full-schedule-provider";

type TeamRow = { id: string; abbreviation: string };
type PeriodRow = { id: string; display_order: number; starts_at: string | null; ends_at: string | null };

async function authorize(request: NextRequest) {
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) return { error: "You must be signed in to import a season.", status: 401 };
  if (!(await requireCommissioner(request))) return { error: "Commissioner access is required.", status: 403 };
  return null;
}

async function prepareImport() {
  const sourceUrl = process.env.NFL_FULL_SCHEDULE_URL ?? NFLVERSE_SCHEDULE_URL;
  let response: Response;
  try {
    response = await fetch(sourceUrl, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error("The full-season schedule provider could not be reached.");
  }
  if (!response.ok) throw new Error("The full-season schedule provider did not return a usable schedule.");
  const games = parseNflverseRegularSeason(await response.text(), CURRENT_SEASON_YEAR);

  const [{ data: season }, { data: teams, error: teamsError }] = await Promise.all([
    supabaseAdmin.from("seasons").select("id, state").eq("year", CURRENT_SEASON_YEAR).maybeSingle(),
    supabaseAdmin.from("teams").select("id, abbreviation").eq("active", true),
  ]);
  if (!season) throw new Error(`The ${CURRENT_SEASON_YEAR} season has not been set up yet.`);
  if (season.state !== "preseason") throw new Error("The full-season bootstrap is preseason-only; use the live reconciliation import after the season begins.");
  if (teamsError || !teams) throw new Error("The NFL team list could not be loaded.");

  const { data: periods, error: periodsError } = await supabaseAdmin.from("scoring_periods")
    .select("id, display_order, starts_at, ends_at").eq("season_id", season.id)
    .eq("period_type", "regular").order("display_order");
  if (periodsError || !periods || periods.length !== 18) throw new Error("Exactly 18 regular-season scoring periods must exist before importing the full schedule.");

  const teamId = new Map((teams as TeamRow[]).map((team) => [team.abbreviation, team.id]));
  const unknownTeams = [...new Set(games.flatMap((game) => [game.awayAbbreviation, game.homeAbbreviation]).filter((team) => !teamId.has(team)))];
  if (unknownTeams.length) throw new Error(`The schedule contains unknown NFL teams: ${unknownTeams.sort().join(", ")}.`);
  const periodByWeek = new Map((periods as PeriodRow[]).map((period) => [period.display_order, period]));
  const periodAssignments = fullSchedulePeriodAssignments(games, periodByWeek);
  for (const assignment of periodAssignments) {
    const period = (periods as PeriodRow[]).find((candidate) => candidate.id === assignment.scoring_period_id);
    if ((period?.starts_at && period.starts_at !== assignment.starts_at) || (period?.ends_at && period.ends_at !== assignment.ends_at)) {
      throw new Error(`A saved scoring-period window conflicts with the provider's Week ${period?.display_order}. Nothing was changed.`);
    }
  }
  const scheduleGames = games.map((game) => ({
    external_game_id: `nflverse:${game.providerEventId}`,
    schedule_source: "nflverse",
    schedule_source_event_id: game.providerEventId,
    scoring_period_id: periodByWeek.get(game.week)?.id,
    away_team_id: teamId.get(game.awayAbbreviation), home_team_id: teamId.get(game.homeAbbreviation),
    kickoff_at: game.kickoffAt, line_lock_at: game.lineLockAt,
    is_international: game.isInternational, gameweek_key: game.gameweekKey,
  }));
  return { season, games, scheduleGames, periodAssignments, sourceUrl };
}

export async function GET(request: NextRequest) {
  const denial = await authorize(request);
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status });
  try {
    const prepared = await prepareImport();
    const weekCounts = Object.fromEntries(Array.from({ length: 18 }, (_, index) => [index + 1, prepared.games.filter((game) => game.week === index + 1).length]));
    return NextResponse.json({ season: CURRENT_SEASON_YEAR, games: prepared.games.length, weeks: 18, weekCounts, source: "nflverse", note: "Validated only. No database rows were changed." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The full schedule could not be prepared." }, { status: 422 });
  }
}

export async function POST(request: NextRequest) {
  const denial = await authorize(request);
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status });
  try {
    const prepared = await prepareImport();
    const { data, error } = await supabaseAdmin.rpc("import_full_schedule_atomically", {
      target_season_id: prepared.season.id,
      period_assignments: prepared.periodAssignments,
      schedule_games: prepared.scheduleGames,
    });
    if (error || !data?.[0]) throw new Error(error?.message ?? "The protected full-schedule import did not complete.");
    return NextResponse.json({ message: "The complete regular-season schedule is loaded and pinned. Daily reconciliation will keep kickoff times and odds identities current.", ...data[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The full schedule could not be imported.";
    return NextResponse.json({ error: message }, { status: message.includes("review") || message.includes("conflict") ? 409 : 422 });
  }
}
