import { fullSchedulePeriodAssignments, MIN_REGULAR_SEASON_GAMES, MIN_REGULAR_SEASON_WEEKS, NFLVERSE_SCHEDULE_URL, parseNflverseRegularSeason, regularSeasonShape } from "@/lib/full-schedule-provider";
import { seasonYearAt } from "@/lib/season";
import { ensureAnnualSeasonRollover } from "@/lib/season-rollover";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishSyncRun } from "@/lib/sync-run";

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
  turnover: {
    status: "blocked" | "completed";
    completed_at: string | null;
    blockers: string[];
    preserved_counts: Record<string, number>;
    deleted_counts: Record<string, number>;
  } | null;
};

export async function getSeasonBootstrapStatus(now = new Date()): Promise<SeasonBootstrapStatus> {
  const seasonYear = seasonYearAt(now);
  const [
    { data: season, error: seasonError },
    { data: lastRun, error: runError },
    { data: turnover, error: turnoverError },
  ] = await Promise.all([
    supabaseAdmin.from("seasons").select("id, state").eq("year", seasonYear).maybeSingle(),
    supabaseAdmin.from("sync_runs").select("status, started_at, completed_at, error_message, details")
      .eq("job_type", "season_bootstrap").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("season_turnover_runs")
      .select("status, completed_at, blockers, preserved_counts, deleted_counts")
      .eq("target_year", seasonYear).maybeSingle(),
  ]);
  if (seasonError || runError || turnoverError) throw new Error("Season bootstrap status could not be loaded.");
  const turnoverStatus = turnover as SeasonBootstrapStatus["turnover"];
  if (!season) return {
    seasonYear, seasonId: null, seasonState: null, regularPeriods: 0,
    loadedGames: 0, complete: false, lastRun, turnover: turnoverStatus,
  };
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
    complete: periodIds.length >= MIN_REGULAR_SEASON_WEEKS && loadedGames >= MIN_REGULAR_SEASON_GAMES,
    lastRun: lastRun as SeasonBootstrapStatus["lastRun"],
    turnover: turnoverStatus,
  };
}
export async function prepareFullSchedule(now = new Date(), signal?: AbortSignal) {
  signal?.throwIfAborted();
  const seasonYear = seasonYearAt(now);
  const sourceUrl = process.env.NFL_FULL_SCHEDULE_URL ?? NFLVERSE_SCHEDULE_URL;
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(30_000);
    response = await fetch(sourceUrl, { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch {
    signal?.throwIfAborted();
    throw new Error("The full-season schedule provider could not be reached.");
  }
  signal?.throwIfAborted();
  if (!response.ok) throw new Error("The full-season schedule provider did not return a usable schedule.");
  let sourceText: string;
  try {
    sourceText = await response.text();
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  }
  signal?.throwIfAborted();
  const games = parseNflverseRegularSeason(sourceText, seasonYear);
  signal?.throwIfAborted();
  const [{ data: season }, { data: teams, error: teamsError }] = await Promise.all([
    supabaseAdmin.from("seasons").select("id, state").eq("year", seasonYear).maybeSingle(),
    supabaseAdmin.from("teams").select("id, abbreviation").eq("active", true),
  ]);
  signal?.throwIfAborted();
  if (!season) throw new Error(`The ${seasonYear} season has not been set up yet.`);
  if (season.state !== "preseason") throw new Error("The full-season bootstrap is preseason-only; use live reconciliation after the season begins.");
  if (teamsError || !teams) throw new Error("The NFL team list could not be loaded.");
  // A longer season than last year's template adds the missing weeks before
  // the playoffs (preseason only). A shorter one stops for review.
  const { weeks } = regularSeasonShape(games);
  const loadPeriods = () => supabaseAdmin.from("scoring_periods")
    .select("id, display_order, starts_at, ends_at").eq("season_id", season.id)
    .eq("period_type", "regular").order("display_order");
  let { data: periods, error: periodsError } = await loadPeriods();
  signal?.throwIfAborted();
  if (!periodsError && periods && periods.length < weeks) {
    signal?.throwIfAborted();
    const { error: extendError } = await supabaseAdmin.rpc("ensure_regular_season_weeks", { target_season_id: season.id, week_count: weeks });
    signal?.throwIfAborted();
    if (extendError) throw new Error(`The season template could not be extended to ${weeks} weeks: ${extendError.message}`);
    ({ data: periods, error: periodsError } = await loadPeriods());
    signal?.throwIfAborted();
  }
  if (periodsError || !periods || periods.length !== weeks) throw new Error(`The ${weeks}-week schedule does not match the season's ${periods?.length ?? 0} regular-season weeks. Nothing was changed.`);
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

export async function bootstrapFullSchedule({ automatic = false, now = new Date(), signal }: { automatic?: boolean; now?: Date; signal?: AbortSignal } = {}) {
  signal?.throwIfAborted();
  if (automatic) await ensureAnnualSeasonRollover(now.toISOString(), signal);
  signal?.throwIfAborted();
  const before = await getSeasonBootstrapStatus(now);
  signal?.throwIfAborted();
  if (before.complete) return { outcome: "already_complete" as const, ...before };
  const { data: run, error: runError } = await supabaseAdmin.from("sync_runs")
    .insert({ provider: "nflverse", job_type: "season_bootstrap", status: "started", details: { automatic, seasonYear: before.seasonYear } })
    .select("id").single();
  if (runError || !run) throw new Error("The season bootstrap attempt could not be recorded.");
  try {
    signal?.throwIfAborted();
    const prepared = await prepareFullSchedule(now, signal);
    signal?.throwIfAborted();
    // From here, the import and its run receipt must complete together. A
    // timeout after this point cannot establish whether the atomic import ran;
    // let its response determine success/failure instead of aborting the call.
    const { data, error } = await supabaseAdmin.rpc("import_full_schedule_atomically", {
      target_season_id: prepared.season.id,
      period_assignments: prepared.periodAssignments,
      schedule_games: prepared.scheduleGames,
    });
    if (error || !data?.[0]) throw new Error(error?.message ?? "The protected full-schedule import did not complete.");
    const result = { outcome: "loaded" as const, seasonYear: prepared.seasonYear, ...data[0] };
    await finishSyncRun(run.id, { status: "success", completed_at: new Date().toISOString(), details: { automatic, ...result } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The full schedule could not be imported.";
    const waiting = /has \d+ regular-season games; expected at least \d+|has not been set up yet/i.test(message);
    await finishSyncRun(run.id, {
      status: waiting ? "success" : "failed", completed_at: new Date().toISOString(),
      error_message: waiting ? null : message, details: { automatic, outcome: waiting ? "waiting_for_complete_feed" : "failed", message },
    });
    if (waiting) return { outcome: "waiting_for_complete_feed" as const, seasonYear: before.seasonYear, message };
    throw error;
  }
}
