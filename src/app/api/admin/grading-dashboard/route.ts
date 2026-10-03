import { NextRequest, NextResponse } from "next/server";
import { getWatchdogStatus } from "@/lib/watchdog-status";
import { checkAutomationHealth } from "@/lib/automation-health";
import { requireCommissioner } from "@/lib/require-commissioner";
import { currentSeasonYear } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { summarizeProviderEfficiency } from "@/lib/provider-efficiency.js";
import { monthlyCreditSeries, slateEfficiencySeries } from "@/lib/provider-chart-data.js";
import { SCORE_POLLING_RETRY_MINUTES } from "@/lib/score-check-backoff";
import { latestWorkerRuns } from "@/lib/latest-worker-runs.js";
import { loadSeasonLadder, type SeasonLadder } from "@/lib/season-ladder";

type GameStatus = "scheduled" | "live" | "final" | "postponed" | "cancelled";
const GAME_STATUS_GRACE_MINUTES = 15;

// Fetch every receipt, including busy months that exceed Supabase's page limit.
async function providerRunsSince(since: string, until: string) {
  const page = (offset: number) => supabaseAdmin.from("sync_runs")
    .select("id, job_type, status, started_at, completed_at, details")
    .eq("provider", "The Odds API").in("status", ["success", "failed"])
    .gte("started_at", since).lte("started_at", until)
    .order("started_at", { ascending: true }).order("id", { ascending: true })
    .range(offset, offset + 999);
  const first = await page(0);
  if (first.error) return first;
  const rows = [...(first.data ?? [])];
  for (let offset = 1000; rows.length === offset; offset += 1000) {
    const more = await page(offset);
    if (more.error) return { data: null, error: more.error };
    rows.push(...(more.data ?? []));
  }
  return { data: rows, error: null };
}

/** The season's retry-rung record rarely changes, so the totals are kept briefly in memory. */
const LADDER_CACHE_MS = 10 * 60 * 1000;
let ladderCache: { key: string; at: number; ladder: SeasonLadder } | null = null;
async function seasonLadder(seasonStart: string, now: Date) {
  if (ladderCache && ladderCache.key === seasonStart && now.getTime() - ladderCache.at < LADDER_CACHE_MS) return ladderCache.ladder;
  const ladder = await loadSeasonLadder(supabaseAdmin, seasonStart);
  ladderCache = { key: seasonStart, at: now.getTime(), ladder };
  return ladder;
}

function minutesSince(value: string | null, now: Date) {
  if (!value) return null;
  const minutes = Math.floor((now.getTime() - new Date(value).getTime()) / 60000);
  return Math.max(0, minutes);
}

function normalizedLatency(game: { id: string; kickoff_at: string; finalized_at: string | null }, games: Array<{ id: string; kickoff_at: string }>) {
  const sorted = [...games].sort((left, right) => new Date(left.kickoff_at).getTime() - new Date(right.kickoff_at).getTime());
  let windowStart = -Infinity;
  let windowEnd = -Infinity;
  const windowEnds = new Map<string, number>();
  for (const item of sorted) {
    const kickoff = new Date(item.kickoff_at).getTime();
    if (kickoff - windowStart > 30 * 60_000) { windowStart = kickoff; windowEnd = kickoff; }
    else windowEnd = Math.max(windowEnd, kickoff);
    windowEnds.set(item.id, windowEnd);
  }
  const finalized = game.finalized_at ? new Date(game.finalized_at).getTime() : NaN;
  const anchor = windowEnds.get(game.id) ?? new Date(game.kickoff_at).getTime();
  return Number.isFinite(finalized) ? Math.max(0, Math.round((finalized - anchor) / 60000)) : null;
}

function gameState(game: { status: GameStatus; kickoff_at: string; finalized_at: string | null }, pending: number, now: Date) {
  if (game.status === "final") return pending > 0 ? "needs_review" : "settled";
  if (game.status === "live") return "live";
  if (game.status === "postponed" || game.status === "cancelled") return "held";
  const staleAfter = new Date(game.kickoff_at).getTime() + GAME_STATUS_GRACE_MINUTES * 60_000;
  return staleAfter < now.getTime() ? "stale" : "scheduled";
}

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  try {
    const now = new Date();
    const [seasonResult, health, watchdog, remindersResult] = await Promise.all([
      supabaseAdmin.from("seasons").select("id, year, state").eq("year", currentSeasonYear()).maybeSingle(),
      checkAutomationHealth(now),
      getWatchdogStatus(),
      supabaseAdmin.from("push_reminders").select("id, category, title, scheduled_for, status, sent_at").order("scheduled_for", { ascending: false }).limit(30),
    ]);
    if (seasonResult.error || remindersResult.error) throw new Error("The grading dashboard could not read operational records.");

    const season = seasonResult.data;
    if (!season) return NextResponse.json({ checkedAt: now.toISOString(), status: "attention", periods: [], errorSummary: ["No current season is configured."], period: null, metrics: null, games: [], attention: [], reminders: [] });

    const { data: periods, error: periodsError } = await supabaseAdmin
      .from("scoring_periods")
      .select("id, display_name, period_type, status, display_order")
      .eq("season_id", season.id)
      .order("display_order");
    if (periodsError) throw new Error("The current scoring period could not be read.");
    const requestedPeriodId = request.nextUrl.searchParams.get("periodId");
    const period = periods?.find((item) => item.id === requestedPeriodId)
      ?? periods?.find((item) => item.status === "active")
      ?? periods?.find((item) => item.status === "upcoming")
      ?? periods?.at(-1)
      ?? null;
    if (!period) return NextResponse.json({ checkedAt: now.toISOString(), status: "attention", periods: periods ?? [], errorSummary: ["No scoring period is configured."], period: null, metrics: null, games: [], attention: [], reminders: [] });
    const previousPeriod = periods?.filter((item) => item.display_order < period.display_order).at(-1) ?? null;

    const seasonPeriodIds = (periods ?? []).map((item) => item.id);
    const [gamesResult, scheduleGamesResult, linesResult, picksResult, survivorResult, teamsResult, syncResult, playersResult, auditResult, survivorEntriesResult, oddsRunsResult, previousGamesResult] = await Promise.all([
      supabaseAdmin.from("games").select("id, kickoff_at, line_lock_at, status, away_score, home_score, finalized_at, away_team_id, home_team_id").eq("scoring_period_id", period.id).order("kickoff_at"),
      seasonPeriodIds.length ? supabaseAdmin.from("games").select("id, scoring_period_id, kickoff_at, line_lock_at, finalized_at, status").in("scoring_period_id", seasonPeriodIds).order("kickoff_at") : Promise.resolve({ data: [], error: null }),
      supabaseAdmin.from("game_lines").select("game_id, locked_spread, locked_at, manual_override").in("game_id", (await supabaseAdmin.from("games").select("id").eq("scoring_period_id", period.id)).data?.map((game) => game.id) ?? []),
      supabaseAdmin.from("picks").select("game_id, result").eq("scoring_period_id", period.id),
      supabaseAdmin.from("survivor_picks").select("game_id, result").eq("scoring_period_id", period.id),
      supabaseAdmin.from("teams").select("id, abbreviation, full_name"),
      supabaseAdmin.from("sync_runs").select("job_type, status, started_at, completed_at, error_message, details").eq("job_type", "scores").order("started_at", { ascending: false }).limit(60),
      supabaseAdmin.from("players").select("id", { count: "exact", head: true }).eq("active", true),
      supabaseAdmin.from("audit_logs").select("id, action, entity_type, entity_id, details, created_at").in("entity_type", ["game", "scoring_period"]).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("survivor_entries").select("status").eq("season_id", season.id),
      providerRunsSince(new Date(Date.UTC(season.year, 0, 1)).toISOString(), now.toISOString()),
      previousPeriod ? supabaseAdmin.from("games").select("id, kickoff_at, finalized_at, status").eq("scoring_period_id", previousPeriod.id) : Promise.resolve({ data: [], error: null }),
    ]);
    if (gamesResult.error || scheduleGamesResult.error || linesResult.error || picksResult.error || survivorResult.error || teamsResult.error || syncResult.error || playersResult.error || auditResult.error || survivorEntriesResult.error || oddsRunsResult.error || previousGamesResult.error) throw new Error("The grading pipeline could not be read.");
    const [lineLockRunsResult, bowlRunsResult] = await Promise.all(["line_locks", "bowl_scores"].map((jobType) =>
      supabaseAdmin.from("sync_runs").select("job_type, status, started_at, completed_at, error_message, details").eq("job_type", jobType).order("started_at", { ascending: false }).limit(1)));
    if (lineLockRunsResult.error || bowlRunsResult.error) throw new Error("The grading dashboard could not read worker activity.");

    const games = gamesResult.data ?? [];
    const lineByGame = new Map((linesResult.data ?? []).map((line) => [line.game_id, line]));
    const picksByGame = new Map<string, { pending: number; total: number; graded: number }>();
    for (const pick of picksResult.data ?? []) {
      const current = picksByGame.get(pick.game_id) ?? { pending: 0, total: 0, graded: 0 };
      current.total += 1;
      if (pick.result === "pending") current.pending += 1; else current.graded += 1;
      picksByGame.set(pick.game_id, current);
    }
    const survivorByGame = new Map<string, { pending: number; total: number }>();
    for (const pick of survivorResult.data ?? []) {
      const current = survivorByGame.get(pick.game_id) ?? { pending: 0, total: 0 };
      current.total += 1;
      if (pick.result === "pending") current.pending += 1;
      survivorByGame.set(pick.game_id, current);
    }
    const teams = new Map((teamsResult.data ?? []).map((team) => [team.id, team]));
    const gameRows = games.map((game) => {
      const pickCounts = picksByGame.get(game.id) ?? { pending: 0, total: 0, graded: 0 };
      const survivorCounts = survivorByGame.get(game.id) ?? { pending: 0, total: 0 };
      const pending = pickCounts.pending + survivorCounts.pending;
      const state = gameState(game as { status: GameStatus; kickoff_at: string; finalized_at: string | null }, pending, now);
      const picksVisible = new Date(game.kickoff_at).getTime() <= now.getTime();
      return {
        id: game.id,
        away: teams.get(game.away_team_id)?.abbreviation ?? "AWAY",
        home: teams.get(game.home_team_id)?.abbreviation ?? "HOME",
        awayName: teams.get(game.away_team_id)?.full_name ?? "Unknown team",
        homeName: teams.get(game.home_team_id)?.full_name ?? "Unknown team",
        kickoffAt: game.kickoff_at,
        lineLockAt: game.line_lock_at,
        status: game.status,
        state,
        score: game.away_score !== null && game.home_score !== null ? `${game.away_score}–${game.home_score}` : null,
        finalizedAt: game.finalized_at,
        line: lineByGame.get(game.id) ? { spread: lineByGame.get(game.id)!.locked_spread, lockedAt: lineByGame.get(game.id)!.locked_at, manual: lineByGame.get(game.id)!.manual_override } : null,
        picks: { total: picksVisible ? pickCounts.total : 0, pending: picksVisible ? pickCounts.pending : 0, graded: picksVisible ? pickCounts.graded : 0, visible: picksVisible },
        survivor: picksVisible ? survivorCounts : { total: 0, pending: 0 },
        // A game being underway without a final is normal. Only finalized
        // games with pending grades, or a missing locked line, belong in the
        // commissioner review queue.
        needsAttention: state === "needs_review" || (new Date(game.line_lock_at).getTime() < now.getTime() && !lineByGame.has(game.id) && game.status === "scheduled"),
      };
    });
    const latestScoreRun = (syncResult.data ?? [])[0] ?? null;
    const latestSuccessfulScoreRun = (syncResult.data ?? []).find((run) => run.status === "success") ?? null;
    const attention = [
      ...gameRows.filter((game) => game.needsAttention).map((game) => ({ id: `game-${game.id}`, severity: game.state === "needs_review" ? "high" : "medium", title: `${game.away} at ${game.home}`, detail: game.state === "needs_review" ? `${game.picks.pending + game.survivor.pending} pick grades are still pending after the final score.` : game.state === "stale" ? `No live or final status ${GAME_STATUS_GRACE_MINUTES} minutes after kickoff.` : "The line-lock window passed without an official line." })),
      ...health.problems.map((problem, index) => ({ id: `health-${index}`, severity: "high", title: "Automation health", detail: problem })),
      ...watchdog.openAlerts.map((alert) => ({ id: `watchdog-${alert.id}`, severity: "high", title: alert.title, detail: alert.detail })),
    ];
    const settled = gameRows.filter((game) => game.state === "settled").length;
    const live = gameRows.filter((game) => game.state === "live").length;
    const pendingGrades = gameRows.reduce((sum, game) => sum + game.picks.pending + game.survivor.pending, 0);
    const gradeEligibleGames = gameRows.filter((game) => game.status === "final").length;
    const gradeCompleteGames = gameRows.filter((game) => game.status === "final" && game.picks.pending + game.survivor.pending === 0).length;
    const pendingGradeGames = Math.max(0, gradeEligibleGames - gradeCompleteGames);
    const latestRunAt = latestSuccessfulScoreRun?.completed_at ?? latestSuccessfulScoreRun?.started_at ?? null;
    const futureGames = gameRows.filter((game) => new Date(game.kickoffAt).getTime() > now.getTime());
    const lineLockedCount = gameRows.filter((game) => Boolean(game.line)).length;
    const pickOutcomeCounts = (picksResult.data ?? []).reduce((counts, pick) => { counts[pick.result as "win" | "loss" | "void" | "pending"] += 1; return counts; }, { win: 0, loss: 0, void: 0, pending: 0 });
    const survivorEntryCounts = (survivorEntriesResult.data ?? []).reduce((counts, entry) => { counts[entry.status as "active" | "eliminated" | "complete"] += 1; return counts; }, { active: 0, eliminated: 0, complete: 0 });
    const reminderCounts = (remindersResult.data ?? []).reduce((counts, reminder) => { counts[reminder.status as "scheduled" | "sending" | "sent" | "cancelled" | "test"] = (counts[reminder.status as "scheduled" | "sending" | "sent" | "cancelled" | "test"] ?? 0) + 1; return counts; }, { scheduled: 0, sending: 0, sent: 0, cancelled: 0, test: 0 });
    const periodTypeById = new Map((periods ?? []).map((item) => [item.id, item.period_type]));
    const regularSeasonGameDates = (scheduleGamesResult.data ?? [])
      .filter((game) => periodTypeById.get(game.scoring_period_id) === "regular")
      .filter((game) => Date.parse(game.kickoff_at) <= now.getTime())
      .map((game) => game.kickoff_at);
    // Season to date: from three days before the first regular-season kickoff (the
    // first spread refreshes), not a rolling month that would drop early weeks.
    const firstKickoff = regularSeasonGameDates.length ? Math.min(...regularSeasonGameDates.map((value) => Date.parse(value))) : now.getTime() - 30 * 86400000;
    const efficiency = summarizeProviderEfficiency((oddsRunsResult.data ?? []).filter((run) => Date.parse(run.started_at) >= firstKickoff - 3 * 86400000), now);
    const efficiencyHistory = slateEfficiencySeries(scheduleGamesResult.data ?? [], oddsRunsResult.data ?? [], now);
    const creditUsage = monthlyCreditSeries(oddsRunsResult.data ?? [], now, scheduleGamesResult.data ?? [], [...SCORE_POLLING_RETRY_MINUTES], regularSeasonGameDates);
    // The whole season's retry-rung record, not a window of recent runs. A failure
    // here only blanks this one chart; it never takes the dashboard down.
    let ladder = { counts: new Map<number, number>(), runs: 0, since: null as string | null };
    try { ladder = await seasonLadder(new Date(Date.UTC(season.year, 0, 1)).toISOString(), now); }
    catch (error) { console.error("The score-polling histogram could not be loaded.", { message: error instanceof Error ? error.message : String(error) }); }
    const ladderCounts = ladder.counts;
    const ladderTotal = [...ladderCounts.values()].reduce((sum, count) => sum + count, 0);
    const ladderSummary = SCORE_POLLING_RETRY_MINUTES.map((windowMinutes, index) => {
      const rung = index + 1;
      const newFinals = ladderCounts.get(rung) ?? 0;
      return { rung, windowMinutes, newFinals, pickedUp: newFinals, percentage: ladderTotal ? Math.round((newFinals / ladderTotal) * 100) : 0, newFinalsPercentage: ladderTotal ? Math.round((newFinals / ladderTotal) * 100) : 0 };
    });
    const settlementLatencies = gameRows.filter((game) => game.state === "settled" && game.finalizedAt).map((game) => normalizedLatency({ id: game.id, kickoff_at: game.kickoffAt, finalized_at: game.finalizedAt }, gameRows.map((item) => ({ id: item.id, kickoff_at: item.kickoffAt })))).filter((value): value is number => value !== null);
    const settlementLatency = { averageMinutes: settlementLatencies.length ? Math.round(settlementLatencies.reduce((sum, value) => sum + value, 0) / settlementLatencies.length) : null, slowestMinutes: settlementLatencies.length ? Math.max(...settlementLatencies) : null, samples: settlementLatencies.length };
    const previousGames = (previousGamesResult.data ?? []).map((game) => ({ id: game.id, kickoff_at: game.kickoff_at, finalized_at: game.finalized_at, status: game.status }));
    const previousLatencies = previousGames.filter((game) => game.status === "final" && game.finalized_at).map((game) => normalizedLatency(game, previousGames)).filter((value): value is number => value !== null);
    const previousAverage = previousLatencies.length ? Math.round(previousLatencies.reduce((sum, value) => sum + value, 0) / previousLatencies.length) : null;
    const latencyHistory = gameRows.filter((game) => game.state === "settled" && game.finalizedAt).map((game) => ({
      label: `${game.away} at ${game.home} · ${new Date(game.kickoffAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      shortLabel: new Date(game.kickoffAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      minutes: normalizedLatency({ id: game.id, kickoff_at: game.kickoffAt, finalized_at: game.finalizedAt }, gameRows.map((item) => ({ id: item.id, kickoff_at: item.kickoffAt }))) ?? 0,
    }));
    const periodLatencyHistory = (periods ?? []).map((item) => {
      const values = (scheduleGamesResult.data ?? []).filter((game) => game.scoring_period_id === item.id && game.status === "final" && game.finalized_at)
        .map((game) => normalizedLatency(game, (scheduleGamesResult.data ?? []).map((item) => ({ id: item.id, kickoff_at: item.kickoff_at })))).filter((value): value is number => value !== null);
      return { id: item.id, label: item.display_name, shortLabel: item.display_name, averageMinutes: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null, samples: values.length };
    }).filter((item) => item.samples > 0);
    return NextResponse.json({
      checkedAt: now.toISOString(),
      status: attention.length ? "attention" : "healthy",
      periods: (periods ?? []).map((item) => ({ id: item.id, displayName: item.display_name, status: item.status, type: item.period_type })),
      period: { id: period.id, displayName: period.display_name, type: period.period_type, status: period.status },
      metrics: { games: gameRows.length, live, settled, awaitingGrade: pendingGrades, gradeEligibleGames, gradeCompleteGames, pendingGradeGames, attention: attention.length, activePlayers: playersResult.count ?? 0, lastScoreSyncAt: latestRunAt, lastScoreSyncAgeMinutes: minutesSince(latestRunAt, now), latestScoreSyncStatus: latestScoreRun?.status ?? "none", providerAllowance: creditUsage.remaining, pickOutcomes: pickOutcomeCounts, survivorEntries: survivorEntryCounts, reminders: reminderCounts, efficiency: { totalCredits: efficiency.totalCredits, scoreCredits: efficiency.scoreCredits, spreadCredits: efficiency.spreadCredits, finalizedGames: efficiency.finalizedGames, creditsPerFinal: efficiency.creditsPerFinal, productiveRate: efficiency.productiveRate, trend: efficiency.trend, history: efficiencyHistory }, settlementLatency: { ...settlementLatency, history: latencyHistory }, comparison: { previousPeriod: previousPeriod?.display_name ?? null, previousAverageMinutes: previousAverage, deltaMinutes: settlementLatency.averageMinutes !== null && previousAverage !== null ? settlementLatency.averageMinutes - previousAverage : null, history: periodLatencyHistory }, readiness: { scheduleLoaded: gameRows.length > 0, linesLocked: lineLockedCount, lineTotal: gameRows.length, nextKickoffAt: futureGames[0]?.kickoffAt ?? null, nextLineLockAt: futureGames.filter((game) => game.lineLockAt).sort((left, right) => new Date(left.lineLockAt).getTime() - new Date(right.lineLockAt).getTime())[0]?.lineLockAt ?? null } },
      games: gameRows,
      attention,
      audit: (auditResult.data ?? []).map((entry) => ({ id: entry.id, action: entry.action, entityType: entry.entity_type, entityId: entry.entity_id, details: entry.details, createdAt: entry.created_at })),
      workerRuns: latestWorkerRuns([...(syncResult.data ?? []), ...(lineLockRunsResult.data ?? []), ...(bowlRunsResult.data ?? [])]).map((run) => ({ jobType: run.job_type, status: run.status, startedAt: run.started_at, completedAt: run.completed_at, error: run.error_message })),
      cadence: { firstCheckMinutesAfterKickoff: 170, cronIntervalMinutes: 10, regularRetryMinutes: [...SCORE_POLLING_RETRY_MINUTES], playoffRetryMinutes: [...SCORE_POLLING_RETRY_MINUTES], note: "Both regular-season and playoff games enter score polling 170 minutes after official kickoff. They then use six 10-minute windows, three 20-minute windows, one 60-minute window, one 120-minute window, and one emergency 240-minute window. The worker is invoked every 10 minutes." },
      scorePolls: (syncResult.data ?? []).filter((run) => run.job_type === "scores").slice(0, 12).map((run) => { const details = run.details && typeof run.details === "object" ? run.details as Record<string, unknown> : {}; return { startedAt: run.started_at, completedAt: run.completed_at, status: run.status, eligibleGames: Number(details.eligibleGames ?? 0), completedGamesFound: Number(details.completedGamesFound ?? 0), finalScoresImported: Number(details.finalScoresImported ?? 0), newFinals: Number(details.newFinals ?? details.finalScoresImported ?? 0), requestsLast: Number(details.requestsLast ?? 0), pollingMode: typeof details.pollingMode === "string" ? details.pollingMode : "—", quotaProtected: details.quotaProtected === true, ladderRungs: details.ladderRungs ?? details.newFinalsByRung ?? {} }; }),
      ladderSummary,
      ladderCoverage: { since: ladder.since, runs: ladder.runs },
      creditUsage,
      incidents: watchdog.recentAlerts.slice(0, 8).map((alert) => ({ id: alert.id, title: alert.title, severity: alert.severity, detectedAt: alert.detected_at, lastSeenAt: alert.last_seen_at, resolvedAt: alert.resolved_at })),
      reminders: (remindersResult.data ?? []).map((reminder) => ({ id: reminder.id, category: reminder.category, title: reminder.title, scheduledFor: reminder.scheduled_for, status: reminder.status, sentAt: reminder.sent_at })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The grading dashboard could not be prepared." }, { status: 500 });
  }
}
