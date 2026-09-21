import { NextRequest, NextResponse } from "next/server";
import { getWatchdogStatus } from "@/lib/automation-watchdog";
import { checkAutomationHealth } from "@/lib/automation-health";
import { requireCommissioner } from "@/lib/require-commissioner";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { summarizeProviderEfficiency } from "@/lib/provider-efficiency.js";
import { recommendPollingPlan, simulatePollingPlans } from "@/lib/polling-plan.js";

type GameStatus = "scheduled" | "live" | "final" | "postponed" | "cancelled";

function minutesSince(value: string | null, now: Date) {
  if (!value) return null;
  const minutes = Math.floor((now.getTime() - new Date(value).getTime()) / 60000);
  return Math.max(0, minutes);
}

function gameState(game: { status: GameStatus; kickoff_at: string; finalized_at: string | null }, pending: number, now: Date) {
  if (game.status === "final") return pending > 0 ? "needs_review" : "settled";
  if (game.status === "live") return "live";
  if (game.status === "postponed" || game.status === "cancelled") return "held";
  return new Date(game.kickoff_at).getTime() < now.getTime() ? "stale" : "scheduled";
}

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  try {
    const now = new Date();
    const [seasonResult, health, watchdog, remindersResult] = await Promise.all([
      supabaseAdmin.from("seasons").select("id, year, state").eq("year", CURRENT_SEASON_YEAR).maybeSingle(),
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

    const [gamesResult, linesResult, picksResult, survivorResult, teamsResult, syncResult, playersResult, auditResult, survivorEntriesResult, oddsRunsResult, previousGamesResult] = await Promise.all([
      supabaseAdmin.from("games").select("id, kickoff_at, line_lock_at, status, away_score, home_score, finalized_at, away_team_id, home_team_id").eq("scoring_period_id", period.id).order("kickoff_at"),
      supabaseAdmin.from("game_lines").select("game_id, locked_spread, locked_at, manual_override").in("game_id", (await supabaseAdmin.from("games").select("id").eq("scoring_period_id", period.id)).data?.map((game) => game.id) ?? []),
      supabaseAdmin.from("picks").select("game_id, result").eq("scoring_period_id", period.id),
      supabaseAdmin.from("survivor_picks").select("game_id, result").eq("scoring_period_id", period.id),
      supabaseAdmin.from("teams").select("id, abbreviation, full_name"),
      supabaseAdmin.from("sync_runs").select("job_type, status, started_at, completed_at, error_message, details").in("job_type", ["scores", "bowl_scores"]).order("started_at", { ascending: false }).limit(12),
      supabaseAdmin.from("players").select("id", { count: "exact", head: true }).eq("active", true),
      supabaseAdmin.from("audit_logs").select("id, action, entity_type, entity_id, details, created_at").in("entity_type", ["game", "scoring_period"]).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("survivor_entries").select("status").eq("season_id", season.id),
      supabaseAdmin.from("sync_runs").select("job_type, status, started_at, completed_at, details").eq("provider", "The Odds API").in("status", ["success", "failed"]).gte("started_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()).order("started_at", { ascending: false }).limit(1000),
      previousPeriod ? supabaseAdmin.from("games").select("kickoff_at, finalized_at, status").eq("scoring_period_id", previousPeriod.id) : Promise.resolve({ data: [], error: null }),
    ]);
    if (gamesResult.error || linesResult.error || picksResult.error || survivorResult.error || teamsResult.error || syncResult.error || playersResult.error || auditResult.error || survivorEntriesResult.error || oddsRunsResult.error || previousGamesResult.error) throw new Error("The grading pipeline could not be read.");

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
        picks: { total: pickCounts.total, pending: pickCounts.pending, graded: pickCounts.graded },
        survivor: survivorCounts,
        needsAttention: state === "needs_review" || state === "stale" || (new Date(game.line_lock_at).getTime() < now.getTime() && !lineByGame.has(game.id) && game.status === "scheduled"),
      };
    });
    const latestScoreRun = (syncResult.data ?? [])[0] ?? null;
    const latestSuccessfulScoreRun = (syncResult.data ?? []).find((run) => run.status === "success") ?? null;
    const attention = [
      ...gameRows.filter((game) => game.needsAttention).map((game) => ({ id: `game-${game.id}`, severity: game.state === "needs_review" ? "high" : "medium", title: `${game.away} at ${game.home}`, detail: game.state === "needs_review" ? `${game.picks.pending + game.survivor.pending} pick grades are still pending after the final score.` : game.state === "stale" ? "Kickoff has passed but the game is not live or final." : "The line-lock window passed without an official line." })),
      ...health.problems.map((problem, index) => ({ id: `health-${index}`, severity: "high", title: "Automation health", detail: problem })),
      ...watchdog.openAlerts.map((alert) => ({ id: `watchdog-${alert.id}`, severity: "high", title: alert.title, detail: alert.detail })),
    ];
    const settled = gameRows.filter((game) => game.state === "settled").length;
    const live = gameRows.filter((game) => game.state === "live").length;
    const pendingGrades = gameRows.reduce((sum, game) => sum + game.picks.pending + game.survivor.pending, 0);
    const latestRunAt = latestSuccessfulScoreRun?.completed_at ?? latestSuccessfulScoreRun?.started_at ?? null;
    const futureGames = gameRows.filter((game) => new Date(game.kickoffAt).getTime() > now.getTime());
    const lineLockedCount = gameRows.filter((game) => Boolean(game.line)).length;
    const pickOutcomeCounts = (picksResult.data ?? []).reduce((counts, pick) => { counts[pick.result as "win" | "loss" | "void" | "pending"] += 1; return counts; }, { win: 0, loss: 0, void: 0, pending: 0 });
    const survivorEntryCounts = (survivorEntriesResult.data ?? []).reduce((counts, entry) => { counts[entry.status as "active" | "eliminated" | "complete"] += 1; return counts; }, { active: 0, eliminated: 0, complete: 0 });
    const reminderCounts = (remindersResult.data ?? []).reduce((counts, reminder) => { counts[reminder.status as "scheduled" | "sending" | "sent" | "cancelled" | "test"] = (counts[reminder.status as "scheduled" | "sending" | "sent" | "cancelled" | "test"] ?? 0) + 1; return counts; }, { scheduled: 0, sending: 0, sent: 0, cancelled: 0, test: 0 });
    const efficiency = summarizeProviderEfficiency(oddsRunsResult.data ?? [], now);
    const settlementLatencies = gameRows.filter((game) => game.state === "settled" && game.finalizedAt).map((game) => Math.max(0, Math.round((new Date(game.finalizedAt!).getTime() - new Date(game.kickoffAt).getTime()) / 60000)));
    const settlementLatency = { averageMinutes: settlementLatencies.length ? Math.round(settlementLatencies.reduce((sum, value) => sum + value, 0) / settlementLatencies.length) : null, slowestMinutes: settlementLatencies.length ? Math.max(...settlementLatencies) : null, samples: settlementLatencies.length };
    const previousLatencies = (previousGamesResult.data ?? []).filter((game) => game.status === "final" && game.finalized_at).map((game) => Math.max(0, Math.round((new Date(game.finalized_at!).getTime() - new Date(game.kickoff_at).getTime()) / 60000)));
    const previousAverage = previousLatencies.length ? Math.round(previousLatencies.reduce((sum, value) => sum + value, 0) / previousLatencies.length) : null;
    const pollingPlans = simulatePollingPlans({ games: gameRows.length });
    const recommendedPlan = recommendPollingPlan({ observedCreditsPerFinal: efficiency.creditsPerFinal, settlementAverageMinutes: settlementLatency.averageMinutes });
    return NextResponse.json({
      checkedAt: now.toISOString(),
      status: attention.length ? "attention" : "healthy",
      periods: (periods ?? []).map((item) => ({ id: item.id, displayName: item.display_name, status: item.status, type: item.period_type })),
      period: { id: period.id, displayName: period.display_name, type: period.period_type, status: period.status },
      metrics: { games: gameRows.length, live, settled, awaitingGrade: pendingGrades, attention: attention.length, activePlayers: playersResult.count ?? 0, lastScoreSyncAt: latestRunAt, lastScoreSyncAgeMinutes: minutesSince(latestRunAt, now), latestScoreSyncStatus: latestScoreRun?.status ?? "none", providerAllowance: health.providerAllowance, pickOutcomes: pickOutcomeCounts, survivorEntries: survivorEntryCounts, reminders: reminderCounts, efficiency: { totalCredits: efficiency.totalCredits, finalizedGames: efficiency.finalizedGames, creditsPerFinal: efficiency.creditsPerFinal, productiveRate: efficiency.productiveRate, trend: efficiency.trend }, settlementLatency, comparison: { previousPeriod: previousPeriod?.display_name ?? null, previousAverageMinutes: previousAverage, deltaMinutes: settlementLatency.averageMinutes !== null && previousAverage !== null ? settlementLatency.averageMinutes - previousAverage : null }, readiness: { scheduleLoaded: gameRows.length > 0, linesLocked: lineLockedCount, lineTotal: gameRows.length, nextKickoffAt: futureGames[0]?.kickoffAt ?? null, nextLineLockAt: futureGames.filter((game) => game.lineLockAt).sort((left, right) => new Date(left.lineLockAt).getTime() - new Date(right.lineLockAt).getTime())[0]?.lineLockAt ?? null } },
      polling: { recommendedPlan, plans: pollingPlans, assumptions: { approvalRequired: true, appliesAutomatically: false } },
      games: gameRows,
      attention,
      audit: (auditResult.data ?? []).map((entry) => ({ id: entry.id, action: entry.action, entityType: entry.entity_type, entityId: entry.entity_id, details: entry.details, createdAt: entry.created_at })),
      workerRuns: (syncResult.data ?? []).slice(0, 8).map((run) => ({ jobType: run.job_type, status: run.status, startedAt: run.started_at, completedAt: run.completed_at, error: run.error_message })),
      incidents: watchdog.recentAlerts.slice(0, 8).map((alert) => ({ id: alert.id, title: alert.title, severity: alert.severity, detectedAt: alert.detected_at, lastSeenAt: alert.last_seen_at, resolvedAt: alert.resolved_at })),
      reminders: (remindersResult.data ?? []).map((reminder) => ({ id: reminder.id, category: reminder.category, title: reminder.title, scheduledFor: reminder.scheduled_for, status: reminder.status, sentAt: reminder.sent_at })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The grading dashboard could not be prepared." }, { status: 500 });
  }
}
