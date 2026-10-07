import { MIN_REGULAR_SEASON_GAMES, MIN_REGULAR_SEASON_WEEKS, NFLVERSE_SCHEDULE_URL, parseNflverseRegularSeason } from "@/lib/full-schedule-provider";
import { seasonYearAt } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { finishSyncRun } from "@/lib/sync-run";

type Team = { id: string; abbreviation: string };
type Period = { id: string; display_order: number };

export async function reconcileFullSeasonSchedule(now = new Date(), signal?: AbortSignal) {
  signal?.throwIfAborted();
  const seasonYear = seasonYearAt(now);
  const { data: season, error: seasonError } = await supabaseAdmin
    .from("seasons").select("id, state").eq("year", seasonYear).maybeSingle();
  signal?.throwIfAborted();
  if (seasonError) throw new Error("The current season could not be loaded for schedule reconciliation.");
  if (!season || season.state === "complete") {
    return { outcome: "not_available" as const, seasonYear };
  }
  const { data: existingPeriods, error: existingPeriodsError } = await supabaseAdmin
    .from("scoring_periods").select("id, display_order").eq("season_id", season.id).eq("period_type", "regular");
  signal?.throwIfAborted();
  if (existingPeriodsError || !existingPeriods || existingPeriods.length < MIN_REGULAR_SEASON_WEEKS) {
    return { outcome: "not_available" as const, seasonYear };
  }
  const { count: canonicalGameCount, error: canonicalGameError } = await supabaseAdmin
    .from("games").select("id", { count: "exact", head: true })
    .in("scoring_period_id", existingPeriods.map((period) => period.id)).eq("schedule_source", "nflverse");
  signal?.throwIfAborted();
  if (canonicalGameError) throw new Error("The canonical schedule state could not be inspected.");
  if ((canonicalGameCount ?? 0) < MIN_REGULAR_SEASON_GAMES) return { outcome: "not_available" as const, seasonYear };

  const since = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const { data: recentRun } = await supabaseAdmin.from("sync_runs")
    .select("started_at, status").eq("provider", "nflverse").eq("job_type", "schedule")
    .gte("started_at", since).order("started_at", { ascending: false }).limit(1).maybeSingle();
  signal?.throwIfAborted();
  if (recentRun?.status === "success") return { outcome: "recently_checked" as const, seasonYear };

  const { data: run, error: runError } = await supabaseAdmin.from("sync_runs")
    .insert({ provider: "nflverse", job_type: "schedule", status: "started", details: { kind: "full_schedule_reconciliation" } })
    .select("id").single();
  if (runError || !run) throw new Error("The schedule reconciliation run could not be recorded.");

  try {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(30_000);
    const response = await fetch(process.env.NFL_FULL_SCHEDULE_URL ?? NFLVERSE_SCHEDULE_URL, {
      cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    signal?.throwIfAborted();
    if (!response.ok) throw new Error("The full NFL schedule provider did not return a usable schedule.");
    let sourceText: string;
    try {
      sourceText = await response.text();
    } catch (error) {
      signal?.throwIfAborted();
      throw error;
    }
    signal?.throwIfAborted();
    const games = parseNflverseRegularSeason(sourceText, seasonYear, { allowWeekGameweekDrift: true });
    signal?.throwIfAborted();
    const [{ data: teams, error: teamError }] = await Promise.all([
      supabaseAdmin.from("teams").select("id, abbreviation").eq("active", true),
    ]);
    signal?.throwIfAborted();
    if (teamError || !teams) {
      throw new Error("The saved teams or regular-season periods are not ready for schedule reconciliation.");
    }
    const teamId = new Map((teams as Team[]).map((team) => [team.abbreviation, team.id]));
    const periodId = new Map((existingPeriods as Period[]).map((period) => [period.display_order, period.id]));
    const payload = games.map((game) => ({
      schedule_source_event_id: game.providerEventId,
      scoring_period_id: periodId.get(game.week),
      away_team_id: teamId.get(game.awayAbbreviation), home_team_id: teamId.get(game.homeAbbreviation),
      kickoff_at: game.kickoffAt, line_lock_at: game.lineLockAt, is_international: game.isInternational,
    }));
    if (payload.some((game) => !game.scoring_period_id || !game.away_team_id || !game.home_team_id)) {
      throw new Error("The full schedule could not be mapped to the saved NFL teams and periods.");
    }
    signal?.throwIfAborted();
    const { data, error } = await supabaseAdmin.rpc("reconcile_full_schedule_atomically", {
      target_season_id: season.id, schedule_games: payload,
    });
    if (error || !data?.[0]) throw new Error(error?.message ?? "The protected schedule reconciliation did not complete.");
    const result = { outcome: "reconciled" as const, seasonYear, ...data[0] };
    await finishSyncRun(run.id, { status: "success", completed_at: new Date().toISOString(), details: result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The full schedule reconciliation failed.";
    await finishSyncRun(run.id, { status: "failed", completed_at: new Date().toISOString(), error_message: message });
    throw error;
  }
}
