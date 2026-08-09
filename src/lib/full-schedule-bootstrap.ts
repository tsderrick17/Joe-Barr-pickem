import { fullSchedulePeriodAssignments, NFLVERSE_SCHEDULE_URL, parseNflverseRegularSeason } from "@/lib/full-schedule-provider";
import { seasonYearAt } from "@/lib/season";
import { ensureAnnualSeasonRollover } from "@/lib/season-rollover";
import { supabaseAdmin } from "@/lib/supabase-admin";

type TeamRow = { id: string; abbreviation: string };
type PeriodRow = { id: string; display_order: number; starts_at: string | null; ends_at: string | null };

export type SeasonBootstrapStatus = {
  seasonYear: number;
  seasonId: string | null;
  seasonState: string | null;
  regularPeriods: number;
  loadedGames: number;
  complete: boolean;
  lastRun: { status: string; started_at: string; completed_at: string | null; error_message: string | null; details: Record<string, unknown> } | null;
};

export async function getSeasonBootstrapStatus(now = new Date()): Promise<SeasonBootstrapStatus> {
  const seasonYear = seasonYearAt(now);
  const [{ data: season, error: seasonError }, { data: lastRun, error: runError }] = await Promise.all([
    supabaseAdmin.from("seasons").select("id, state").eq("year", seasonYear).maybeSingle(),
    supabaseAdmin.from("sync_runs").select("status, started_at, completed_at, error_message, details")
      .eq("job_type", "season_bootstrap").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (seasonError || runError) throw new Error("Season bootstrap status could not be loaded.");
  if (!season) return { seasonYear, seasonId: null, seasonState: null, regularPeriods: 0, loadedGames: 0, complete: false, lastRun };
  const { data: periods, error: periodsError } = await supabaseAdmin.from("scoring_periods")
    .select("id").eq("season_id", season.id).eq("period_type", "regular");
  if (periodsError) throw new Error("Season bootstrap periods could not be loaded.");
  const periodIds = (periods ?? []).map((period) => period.id);
  const { count, error: gamesError } = periodIds.length
    ? await supabaseAdmin.from("games").select("id", { count: "exact", head: true }).in("scoring_period_id", periodIds)
    : { count: 0, error: null };
  if (gamesError) throw new Error("Season bootstrap games could not be loaded.");
  const loadedGames = count ?? 0;
  return {
    seasonYear, seasonId: season.id, seasonState: season.state,
    regularPeriods: periodIds.length, loadedGames,
    complete: periodIds.length === 18 && loadedGames === 272,
    lastRun: lastRun as SeasonBootstrapStatus["lastRun"],
  };
}
export async function prepareFullSchedule(now = new Date()) {
  const seasonYear = seasonYearAt(now);
  const sourceUrl = process.env.NFL_FULL_SCHEDULE_URL ?? NFLVERSE_SCHEDULE_URL;
  let response: Response;
  try {
    response = await fetch(sourceUrl, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error("The full-season schedule provider could not be reached.");
  }
  if (!response.ok) throw new Error("The full-season schedule provider did not return a usable schedule.");
  const games = parseNflverseRegularSeason(await response.text(), seasonYear);
  const [{ data: season }, { data: teams, error: teamsError }] = await Promise.all([
    supabaseAdmin.from("seasons").select("id, state").eq("year", seasonYear).maybeSingle(),
    supabaseAdmin.from("teams").select("id, abbreviation").eq("active", true),
  ]);
  if (!season) throw new Error(`The ${seasonYear} season has not been set up yet.`);
  if (season.state !== "preseason") throw new Error("The full-season bootstrap is preseason-only; use live reconciliation after the season begins.");
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
    schedule_source: "nflverse", schedule_source_event_id: game.providerEventId,
    scoring_period_id: periodByWeek.get(game.week)?.id,
    away_team_id: teamId.get(game.awayAbbreviation), home_team_id: teamId.get(game.homeAbbreviation),
    kickoff_at: game.kickoffAt, line_lock_at: game.lineLockAt,
    is_international: game.isInternational, gameweek_key: game.gameweekKey,
  }));
  return { seasonYear, season, games, scheduleGames, periodAssignments, sourceUrl };
}

export async function bootstrapFullSchedule({ automatic = false, now = new Date() } = {}) {
  if (automatic) await ensureAnnualSeasonRollover(now.toISOString());
  const before = await getSeasonBootstrapStatus(now);
  if (before.complete) return { outcome: "already_complete" as const, ...before };
  const { data: run, error: runError } = await supabaseAdmin.from("sync_runs")
    .insert({ provider: "nflverse", job_type: "season_bootstrap", status: "started", details: { automatic, seasonYear: before.seasonYear } })
    .select("id").single();
  if (runError || !run) throw new Error("The season bootstrap attempt could not be recorded.");
  try {
    const prepared = await prepareFullSchedule(now);
    const { data, error } = await supabaseAdmin.rpc("import_full_schedule_atomically", {
      target_season_id: prepared.season.id,
      period_assignments: prepared.periodAssignments,
      schedule_games: prepared.scheduleGames,
    });
    if (error || !data?.[0]) throw new Error(error?.message ?? "The protected full-schedule import did not complete.");
    const result = { outcome: "loaded" as const, seasonYear: prepared.seasonYear, ...data[0] };
    await supabaseAdmin.from("sync_runs").update({ status: "success", completed_at: new Date().toISOString(), details: { automatic, ...result } }).eq("id", run.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The full schedule could not be imported.";
    const waiting = /has \d+ regular-season games; expected 272|has not been set up yet/i.test(message);
    await supabaseAdmin.from("sync_runs").update({
      status: waiting ? "success" : "failed", completed_at: new Date().toISOString(),
      error_message: waiting ? null : message, details: { automatic, outcome: waiting ? "waiting_for_complete_feed" : "failed", message },
    }).eq("id", run.id);
    if (waiting) return { outcome: "waiting_for_complete_feed" as const, seasonYear: before.seasonYear, message };
    throw error;
  }
}
