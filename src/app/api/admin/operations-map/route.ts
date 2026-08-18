import { NextRequest, NextResponse } from "next/server";
import { checkAutomationHealth } from "@/lib/automation-health";
import { getWatchdogStatus } from "@/lib/automation-watchdog";
import { requireCommissioner } from "@/lib/require-commissioner";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";

type StageState = "complete" | "active" | "waiting" | "attention";
type GameRow = {
  id: string;
  kickoff_at: string;
  line_lock_at: string;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled" | "no_contest";
};

function nextTime(values: string[], now: Date) {
  return values
    .filter((value) => new Date(value).getTime() > now.getTime())
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null;
}

function stage(id: string, label: string, state: StageState, detail: string, next: string) {
  return { id, label, state, detail, next };
}

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  try {
    const now = new Date();
    const [seasonResult, activePlayersResult, health, watchdog] = await Promise.all([
      supabaseAdmin.from("seasons").select("id, state").eq("year", CURRENT_SEASON_YEAR).maybeSingle(),
      supabaseAdmin.from("players").select("id", { count: "exact", head: true }).eq("active", true),
      checkAutomationHealth(now),
      getWatchdogStatus(),
    ]);

    if (seasonResult.error || activePlayersResult.error) throw new Error("The current pool could not be read.");
    const season = seasonResult.data;
    if (!season) {
      return NextResponse.json({
        checkedAt: now.toISOString(),
        overall: "attention",
        headline: "The season needs setup",
        summary: `Create the ${CURRENT_SEASON_YEAR} season before the operating flow can begin.`,
        currentStageId: "schedule",
        openIncidentCount: watchdog.openAlerts.length,
        stages: [
          stage("schedule", "Schedule", "attention", "No current season record was found.", "Create the season, then load and pin its schedule."),
          stage("selections", "Selections", "waiting", "Player selections wait for an active scoring period.", "Begins after the schedule is ready."),
          stage("lines", "Line locks", "waiting", "Official lines wait for scheduled games.", "Begins before each game locks."),
          stage("scores", "Games & scoring", "waiting", "Scoring waits for games to begin.", "Begins at kickoff."),
          stage("results", "Results & recap", "waiting", "Results wait for final scores.", "Begins after the games settle."),
        ],
      });
    }

    const { data: periods, error: periodsError } = await supabaseAdmin
      .from("scoring_periods")
      .select("id, display_name, display_order, status, period_type, max_picks, starts_at")
      .eq("season_id", season.id)
      .in("status", ["active", "upcoming"])
      .order("display_order");
    if (periodsError) throw new Error("The scoring periods could not be read.");

    const period = periods?.find((item) => item.status === "active") ?? periods?.[0] ?? null;
    const [gamesResult, picksResult] = period
      ? await Promise.all([
          supabaseAdmin.from("games").select("id, kickoff_at, line_lock_at, status").eq("scoring_period_id", period.id).order("kickoff_at"),
          supabaseAdmin.from("picks").select("player_id").eq("scoring_period_id", period.id).neq("result", "void"),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (gamesResult.error || picksResult.error) throw new Error("The active pool stage could not be read.");

    const games = (gamesResult.data ?? []) as GameRow[];
    const gameIds = games.map((game) => game.id);
    const linesResult = gameIds.length
      ? await supabaseAdmin.from("game_lines").select("game_id").in("game_id", gameIds)
      : { data: [], error: null };
    if (linesResult.error) throw new Error("Official-line progress could not be read.");

    const lineIds = new Set((linesResult.data ?? []).map((line) => line.game_id));
    const playable = games.filter((game) => !["postponed", "cancelled", "no_contest"].includes(game.status));
    const upcoming = playable.filter((game) => new Date(game.kickoff_at).getTime() > now.getTime());
    const live = playable.filter((game) => game.status === "live");
    const finals = playable.filter((game) => game.status === "final");
    const lockedLines = playable.filter((game) => lineIds.has(game.id)).length;
    const nextLock = nextTime(playable.map((game) => game.line_lock_at), now);
    const nextKickoff = nextTime(playable.map((game) => game.kickoff_at), now);
    const pickCounts = new Map<string, number>();
    for (const pick of picksResult.data ?? []) pickCounts.set(pick.player_id, (pickCounts.get(pick.player_id) ?? 0) + 1);
    const fullCards = [...pickCounts.values()].filter((count) => count >= (period?.max_picks ?? 1)).length;
    const activePlayerCount = activePlayersResult.count ?? 0;
    const formatEvent = (value: string | null) => value
      ? new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
      : null;

    const noPeriod = !period;
    const noGames = Boolean(period && games.length === 0);
    const scoreProblem = health.problems.find((problem) => /score|final/i.test(problem));
    const reminderProblem = health.reminderHealth.overdueScheduled > 0 || health.reminderHealth.staleSending > 0;
    const lineProblem = health.missingOfficialLines > 0;

    const stages = [
      stage(
        "schedule",
        "Schedule",
        noPeriod || noGames ? "attention" : "complete",
        noPeriod ? "No active or upcoming scoring period was found." : noGames ? `${period.display_name} has no games loaded.` : `${period.display_name} has ${playable.length} playable game${playable.length === 1 ? "" : "s"} pinned.`,
        noPeriod ? "Set up the next scoring period." : noGames ? "Load the schedule before opening selections." : "The schedule now feeds selections and automatic line checks.",
      ),
      stage(
        "selections",
        "Selections",
        period?.status === "upcoming" || noGames ? "waiting" : upcoming.length ? "active" : "complete",
        period?.status === "upcoming" ? `${period.display_name} is staged and waiting to open.` : `${fullCards} full Pick'em card${fullCards === 1 ? " is" : "s are"} saved${period?.period_type === "regular" ? ` among ${activePlayerCount} active players` : ""}.`,
        period?.status === "upcoming" ? "Selections open when the scoring period activates." : nextKickoff ? `The next selections become public at ${formatEvent(nextKickoff)}.` : "All scheduled games in this period have started.",
      ),
      stage(
        "lines",
        "Line locks",
        lineProblem ? "attention" : playable.length > 0 && lockedLines === playable.length ? "complete" : lockedLines > 0 ? "active" : "waiting",
        lineProblem ? `${health.missingOfficialLines} game${health.missingOfficialLines === 1 ? " is" : "s are"} past lock without an official line.` : `${lockedLines} of ${playable.length} official lines are locked.`,
        lineProblem ? "The missing line is holding up a safe game-day handoff." : nextLock ? `The next automatic line lock is ${formatEvent(nextLock)}.` : "No future line lock is waiting in this period.",
      ),
      stage(
        "scores",
        "Games & scoring",
        scoreProblem ? "attention" : live.length || health.scoreCandidates > 0 ? "active" : playable.length > 0 && finals.length === playable.length ? "complete" : "waiting",
        scoreProblem ?? (live.length ? `${live.length} game${live.length === 1 ? " is" : "s are"} live; automatic score checks will follow.` : `${finals.length} of ${playable.length} games are final.`),
        scoreProblem ? "Automatic retries are scheduled; use manual recovery only after verifying the provider." : nextKickoff ? `The next kickoff is ${formatEvent(nextKickoff)}.` : finals.length < playable.length ? "The score worker will check eligible games automatically." : "Final grades can now feed the period handoff.",
      ),
      stage(
        "results",
        "Results & recap",
        reminderProblem ? "attention" : period?.status === "active" && playable.length > 0 && finals.length === playable.length ? "active" : period?.status === "upcoming" ? "waiting" : "waiting",
        reminderProblem ? `${health.reminderHealth.overdueScheduled} overdue and ${health.reminderHealth.staleSending} stuck message${health.reminderHealth.staleSending === 1 ? "" : "s"}.` : finals.length === playable.length && playable.length > 0 ? "All games are final; the safe handoff and recap are next." : "Results and the preserved recap wait for every game and grade to settle.",
        reminderProblem ? "Clear the delivery hold before relying on the recap." : "After settlement, the next period opens and the Tuesday recap is preserved by email.",
      ),
    ];

    const attentionStage = stages.find((item) => item.state === "attention");
    const activeStage = stages.find((item) => item.state === "active");
    const current = attentionStage ?? activeStage ?? stages.find((item) => item.state === "waiting") ?? stages[stages.length - 1];
    const openIncidentCount = watchdog.openAlerts.length;
    const overall = attentionStage || openIncidentCount ? "attention" : "healthy";

    return NextResponse.json({
      checkedAt: now.toISOString(),
      overall,
      headline: overall === "healthy" ? "The pool is moving normally" : "The pool needs your attention",
      summary: openIncidentCount
        ? `${openIncidentCount} watchdog incident${openIncidentCount === 1 ? " is" : "s are"} open. The highlighted stage shows where to start.`
        : attentionStage
          ? `${attentionStage.label} is the first stage holding up the normal flow.`
          : `${current.label} is the current stage. The next step is already scheduled.`,
      currentStageId: current.id,
      openIncidentCount,
      providerAllowance: health.providerAllowance,
      stages,
    });
  } catch {
    return NextResponse.json({ error: "The live operations map could not be prepared." }, { status: 500 });
  }
}
