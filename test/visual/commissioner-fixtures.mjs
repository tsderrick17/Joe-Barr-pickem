/**
 * Fixed sample data for the Commissioner desk screenshot baseline: the
 * operations overview, grading workspace, game-day, Bowl Pool, system and
 * season-setup panels, plus the Players and Reminders pages. Fictional names;
 * nothing here comes from or goes to a real database.
 */

export const NOW = "2026-10-04T18:30:00Z";
const T = (hoursAgo) => new Date(Date.parse(NOW) - hoursAgo * 3_600_000).toISOString();
const IN = (hours) => new Date(Date.parse(NOW) + hours * 3_600_000).toISOString();

const STAGES = (states) => [
  ["schedule", "Schedule loaded"], ["selections", "Selections open"], ["lines", "Lines locked"], ["scores", "Scores syncing"], ["results", "Results graded"], ["handoff", "Week handed off"],
].map(([id, label], index) => ({ id, label, state: states[index], detail: `${label}: sample detail line.`, next: `Next step for ${label.toLowerCase()}.` }));

function operationsMap(state) {
  if (state === "attention") return { checkedAt: NOW, overall: "attention", headline: "One item needs your attention", summary: "A score sync failed twice; a retry is scheduled.", currentStageId: "scores", openIncidentCount: 1, providerAllowance: 412, providerCreditSnapshot: { used: 88, remaining: 412, limit: 500, reportedAt: T(2) }, release: "sample-release", stages: STAGES(["complete", "complete", "complete", "attention", "waiting", "waiting"]) };
  if (state === "quiet") return { checkedAt: NOW, overall: "healthy", headline: "Nothing scheduled right now", summary: "The next week opens Wednesday.", currentStageId: "handoff", openIncidentCount: 0, providerAllowance: 490, providerCreditSnapshot: { used: 10, remaining: 490, limit: 500, reportedAt: T(30) }, release: "sample-release", stages: STAGES(["complete", "complete", "complete", "complete", "complete", "complete"]) };
  return { checkedAt: NOW, overall: "healthy", headline: "Game day is running smoothly", summary: "Lines are locked and scores are syncing.", currentStageId: "scores", openIncidentCount: 0, providerAllowance: 455, providerCreditSnapshot: { used: 45, remaining: 455, limit: 500, reportedAt: T(1) }, release: "sample-release", stages: STAGES(["complete", "complete", "complete", "active", "waiting", "waiting"]) };
}

const DAYS = Array.from({ length: 30 }, (_, index) => {
  const date = `2026-10-${String(index + 1).padStart(2, "0")}`;
  const credits = index % 7 === 6 ? 14 : index % 7 === 0 ? 3 : 1;
  return { date, credits, cumulative: 0, scores: Math.floor(credits * 0.6), lines: Math.floor(credits * 0.3), other: credits - Math.floor(credits * 0.6) - Math.floor(credits * 0.3), estimatedCalls: credits };
}).map((day, index, all) => ({ ...day, cumulative: all.slice(0, index + 1).reduce((sum, item) => sum + item.credits, 0) }));

const CREDIT_USAGE = {
  monthLabel: "October 2026", trackedCredits: 88, forecastCredits: 190, forecastTotal: 278, forecastFrom: "2026-10-05", forecastAssumptions: "Sample forecast assumptions.",
  reportedUsed: 88, providerLimit: 500, sundayAverageCredits: 14, regularSundaysElapsed: 1, remaining: 412, reportedAt: T(1),
  days: DAYS.slice(0, 4),
  calendarDays: DAYS.map((day) => ({ ...day, forecast: 0, forecastCumulative: null, forecastScores: 0, forecastLines: 0, forecastOther: 0, forecastGames: 0, forecastSlates: 0 })),
};

const GAMES = [
  ["g1", "IND", "WAS", "Indianapolis Colts", "Washington Commanders", "final", "24-19", false, 0],
  ["g2", "LAR", "PHI", "Los Angeles Rams", "Philadelphia Eagles", "live", "14-10", false, 0],
  ["g3", "CIN", "JAX", "Cincinnati Bengals", "Jacksonville Jaguars", "live", "7-3", false, 0],
  ["g4", "GB", "TB", "Green Bay Packers", "Tampa Bay Buccaneers", "scheduled", null, false, 0],
  ["g5", "HOU", "DAL", "Houston Texans", "Dallas Cowboys", "scheduled", null, false, 0],
].map(([id, away, home, awayName, homeName, status, score, needsAttention], index) => ({
  id, away, home, awayName, homeName, kickoffAt: IN(index - 2), finalizedAt: status === "final" ? T(1) : null, status, state: status, score, needsAttention,
  picks: { total: 8, pending: status === "final" ? 0 : 8, graded: status === "final" ? 8 : 0, visible: status !== "scheduled" }, survivor: { total: 4, pending: status === "final" ? 0 : 4 },
}));

function dashboard(state) {
  const attention = state === "attention";
  const quiet = state === "quiet";
  const games = quiet ? GAMES.map((game) => ({ ...game, status: "final", state: "final", finalizedAt: T(30), score: "21-17", picks: { total: 8, pending: 0, graded: 8, visible: true }, survivor: { total: 4, pending: 0 } })) : GAMES.map((game, index) => (attention && index === 0 ? { ...game, needsAttention: true, status: "final", state: "awaiting grade" } : game));
  return {
    checkedAt: NOW, creditUsage: CREDIT_USAGE, ladderCoverage: { since: T(200), runs: 40 },
    ladderSummary: [10, 10, 10, 10, 10, 10, 20, 20, 20, 60, 120, 240].map((windowMinutes, index) => { const newFinals = [16, 17, 12, 2, 1, 0, 0, 0, 0, 0, 1, 1][index]; return { rung: index + 1, windowMinutes, newFinals, pickedUp: newFinals, percentage: newFinals * 2, newFinalsPercentage: newFinals * 2 }; }),
    status: attention ? "attention" : "healthy",
    periods: [{ id: "p5", displayName: "Week 5", status: quiet ? "complete" : "active", type: "regular" }, { id: "p4", displayName: "Week 4", status: "complete", type: "regular" }],
    period: { id: "p5", displayName: "Week 5", type: "regular", status: quiet ? "complete" : "active" },
    metrics: {
      games: 5, live: quiet ? 0 : 2, settled: quiet ? 5 : 1, awaitingGrade: attention ? 1 : 0, gradeEligibleGames: quiet ? 5 : 1, gradeCompleteGames: quiet ? 5 : attention ? 0 : 1, pendingGradeGames: attention ? 1 : 0, attention: attention ? 2 : 0, activePlayers: 8,
      lastScoreSyncAt: attention ? T(3) : T(0.1), lastScoreSyncAgeMinutes: attention ? 180 : 6, latestScoreSyncStatus: attention ? "failed" : "success", providerAllowance: 455,
      pickOutcomes: { win: 14, loss: 10, void: 0, pending: quiet ? 0 : 16 }, survivorEntries: { active: 5, eliminated: 3, complete: 0 },
      reminders: { scheduled: quiet ? 2 : 4, sending: 0, sent: 12, cancelled: 1, test: 0 },
      efficiency: { totalCredits: 88, scoreCredits: 52, spreadCredits: 36, finalizedGames: 40, creditsPerFinal: 2.2, productiveRate: 0.74, trend: "improving", history: [3, 2.6, 2.4, 2.2].map((value, index) => ({ slateStartedAt: T(24 * 7 * (4 - index)), creditsPerFinal: value, creditsPerGame: value - 0.3, latencyMinutes: 12 - index, settledGames: [14, 15, 14, 15][index], productiveRate: 0.7 + index * 0.02, credits: [44, 38, 31, 27][index], finals: 14, games: [14, 15, 14, 15][index], calls: 20, attribution: "sample" })) },
      settlementLatency: { averageMinutes: 11, slowestMinutes: 24, samples: 14, history: [14, 12, 11, 9].map((minutes, index) => ({ label: `Week ${index + 1}`, shortLabel: `W${index + 1}`, minutes })) },
      comparison: { previousPeriod: "Week 4", previousAverageMinutes: 13, deltaMinutes: -2, history: [1, 2, 3, 4].map((week) => ({ id: `w${week}`, label: `Week ${week}`, shortLabel: `W${week}`, averageMinutes: 14 - week, samples: 14 })) },
      readiness: { scheduleLoaded: true, linesLocked: 5, lineTotal: 5, nextKickoffAt: quiet ? IN(60) : IN(3), nextLineLockAt: quiet ? IN(52) : null },
    },
    games,
    attention: attention ? [{ id: "a1", severity: "warning", title: "Score sync failed", detail: "The last two score checks failed; a retry is scheduled." }, { id: "a2", severity: "info", title: "Final awaiting grade", detail: "IND at WAS is final and waiting to be graded." }] : [],
    audit: Array.from({ length: 6 }, (_, index) => ({ id: `e${index}`, action: ["final_score_imported", "lines_locked", "picks_graded"][index % 3], entityType: "game", details: {}, createdAt: T(index + 1) })),
    workerRuns: [{ jobType: "scores", status: attention ? "failed" : "success", startedAt: T(attention ? 3 : 0.1), completedAt: T(attention ? 3 : 0.1), error: attention ? "Provider timed out" : null }, { jobType: "line_lock", status: "success", startedAt: T(10), completedAt: T(10), error: null }],
    cadence: { firstCheckMinutesAfterKickoff: 150, cronIntervalMinutes: 5, regularRetryMinutes: [5, 10, 20], playoffRetryMinutes: [3, 5, 10], note: "Sample cadence note." },
    scorePolls: Array.from({ length: 4 }, (_, index) => ({ startedAt: T(index + 1), completedAt: T(index + 1), status: "success", eligibleGames: 3, completedGamesFound: 1, finalScoresImported: 1, newFinals: 1, requestsLast: 1, pollingMode: "regular", quotaProtected: false })),
    incidents: attention ? [{ id: "i1", title: "Score provider timeouts", severity: "warning", detectedAt: T(3), lastSeenAt: T(0.2), resolvedAt: null }, { id: "i0", title: "Late line lock", severity: "info", detectedAt: T(100), lastSeenAt: T(99), resolvedAt: T(98) }] : [{ id: "i0", title: "Late line lock", severity: "info", detectedAt: T(100), lastSeenAt: T(99), resolvedAt: T(98) }],
    reminders: [{ id: "r1", category: "weekly", title: "Week 6 Slate is open", scheduledFor: IN(70), status: "scheduled" }],
  };
}

const WATCHDOG = (state) => ({
  openAlerts: state === "attention" ? [{ id: "w1", severity: "warning", title: "Score sync failing", detail: "Two consecutive provider timeouts.", detected_at: T(3), notified_at: T(2.9), notification_error: null }] : [],
  lastRun: { status: "success", completed_at: T(0.1), error_message: null },
});
const HEALTH = (state) => ({
  status: state === "attention" ? "attention" : "healthy", problems: state === "attention" ? ["Score checks have failed twice in a row."] : [],
  latestSuccessfulLocks: { started_at: T(10), completed_at: T(10), status: "success" }, latestSuccessfulScores: { started_at: T(state === "attention" ? 3 : 0.1), completed_at: T(state === "attention" ? 3 : 0.1), status: "success" },
  scoreCandidates: state === "quiet" ? 0 : 2, scoreProviderFailureStreak: state === "attention" ? 2 : 0, scoreProviderRetryAt: state === "attention" ? IN(0.1) : null, scoreCheckStatus: state === "attention" ? "retrying" : state === "quiet" ? "idle" : "scheduled",
  scheduleProviderCircuit: null, scheduleProviderCooldownActive: false, reminderHealth: { overdueScheduled: 0, staleSending: 0, recentEmailFailures: 0 }, providerAllowance: 455,
  retention: { candidates: 0, cutoff: T(24 * 365) }, criticalWorkers: { healthy: state !== "attention", messages: state === "attention" ? ["The score worker last failed."] : [] },
});
const PREFLIGHT = (state) => ({
  checkedAt: NOW, status: state === "attention" ? "attention" : "healthy",
  checks: [["schedules", "Score sync scheduled", true], ["schedules", "Line lock scheduled", true], ["authorization", "Cron secret accepted", true], ["providers", "Odds provider reachable", state !== "attention"], ["alerts", "Commissioner alert email set", true]]
    .map(([group, label, passed], index) => ({ check_id: `c${index}`, label, passed, detail: passed ? "OK" : "Needs a look", group })),
});
const CAPACITY = {
  checkedAt: NOW,
  accounts: [
    { id: "odds", service: "odds-api", metric: "Credits", used: 88, limit: 500, unit: "credits", period: "month", observedAt: T(1), detail: "Sample provider allowance.", connection: "live" },
    { id: "brevo", service: "brevo", metric: "Emails today", used: 12, limit: 300, unit: "emails", period: "day", observedAt: T(1), detail: "Sample email allowance.", connection: "estimated" },
    { id: "supabase", service: "supabase", metric: "Database", used: 90, limit: 500, unit: "MB", period: "total", observedAt: T(2), detail: "Sample database size.", connection: "live" },
    { id: "vercel", service: "vercel", metric: "Function CPU", used: null, limit: null, unit: "hours", period: "month", observedAt: null, detail: "Not connected.", connection: "awaiting_connection" },
  ],
  storageTables: [["picks", 4_200_000, 120_000], ["games", 2_100_000, 3_000], ["audit_log", 1_400_000, 41_000]].map(([relation_name, total_bytes, estimated_rows]) => ({ relation_name, total_bytes, table_bytes: Math.round(total_bytes * 0.7), index_bytes: Math.round(total_bytes * 0.3), estimated_rows })),
};
const BOWL_READINESS = (state) => ({ checkedAt: NOW, seasonYear: 2026, playerVisibleAt: "2026-11-30T05:00:00Z", firstKickoffAt: "2026-12-19T18:00:00Z", games: 42, missingTeams: state === "attention" ? 2 : 0, missingLines: state === "attention" ? 5 : 0, nextKickoffAt: "2026-12-19T18:00:00Z", openScheduleChanges: state === "attention" ? 1 : 0, cronHealth: "ok", lockedGames: 0, integrity: { healthy: true, problems: [] }, settlement: { healthy: true, problems: [] } });
const BOWL_EXCEPTIONS = (state) => ({ games: state === "attention" ? [{ id: "b1", bowlName: "Frisco Bowl", kickoffAt: "2026-12-19T18:00:00Z", status: "scheduled", awayTeam: "Memphis", homeTeam: "Toledo" }] : [], scheduleChanges: state === "attention" ? [{ id: "s1", game_id: "b1", old_kickoff_at: "2026-12-19T18:00:00Z", new_kickoff_at: "2026-12-19T21:00:00Z", detected_at: T(5) }] : [] });
const BOOTSTRAP = { seasonYear: 2026, seasonState: "active", regularPeriods: 18, loadedGames: 272, complete: true, lastRun: { status: "success", completed_at: T(500), error_message: null, details: { outcome: "loaded" } }, turnover: { status: "completed", completed_at: T(900), blockers: [], preserved_counts: { players: 8, seasons: 3 }, deleted_counts: { picks: 0 } } };

/** Everything the desk calls, keyed by the endpoint's path after /api/. */
export function commissionerApi(state) {
  return {
    "admin/operations-map": operationsMap(state),
    "admin/grading-dashboard": dashboard(state),
    "admin/watchdog": WATCHDOG(state),
    "admin/automation-health": HEALTH(state),
    "admin/automation-preflight": PREFLIGHT(state),
    "admin/account-capacity": CAPACITY,
    "admin/pool-stats": POOL_STATS,
    "admin/bowl-pool-readiness": BOWL_READINESS(state),
    "admin/bowl-pool/exceptions": BOWL_EXCEPTIONS(state),
    "admin/season-bootstrap-status": BOOTSTRAP,
  };
}

export const PLAYERS = {
  players: [
    ["p0", "Gary", true, true, true, 0.2], ["p1", "Connor", true, false, true, 2], ["p2", "Tyler", true, true, true, 0.1], ["p3", "Rick", true, false, false, 30],
    ["p4", "Zac", true, false, true, 5], ["p5", "Ron", true, false, true, 70], ["p6", "Al", false, false, false, 900], ["p7", "Dana", true, false, true, null],
  ].map(([id, firstName, active, isCommissioner, emailNotificationsEnabled, hoursAgo]) => ({ id, firstName, loginPin: id === "p7" ? null : "0000", active, isCommissioner, emailNotificationsEnabled, forfeited: id === "p5", createdAt: T(2000), lastActiveAt: hoursAgo === null ? null : T(hoursAgo) })),
};

export const REMINDERS = {
  reminders: [
    ["r1", "weekly", "Week 6 Slate is open", "scheduled", null, 0, 0, 0, IN(70)],
    ["r2", "final_lines", "Final lines for Sunday", "scheduled", null, 0, 0, 0, IN(16)],
    ["r3", "sunday_early_reveal", "Early picks are public", "sent", null, 7, 0, 1, T(5)],
    ["r4", "weekly_recap", "Week 4 recap", "sent", null, 8, 1, 0, T(120)],
    ["r5", "featured_window_reveal", "Featured game picks", "cancelled", "Nobody selected a represented game", 0, 0, 0, T(30)],
  ].map(([id, category, title, status, suppressionReason, emailDelivered, emailFailed, emailSuppressed, scheduledFor]) => ({ id, category, audience: "weekly", title, body: `${title}: sample body.`, scheduledFor, status, suppressionReason, emailDelivered, emailFailed, emailSuppressed })),
};

/** The Trophy Room: two crowned seasons (one with co-champions and one pool not crowned yet), and an all-time table with qualified and unqualified players. */
const champion = (playerId, name) => ({ playerId, name });
const exit = (averageWeek, exits) => ({ averageWeek, exits });
const row = (playerId, name, seasons, ab, h, avg, slg, best, streak, survivorExit, titles) => ({ playerId, name, seasons, ab, h, avg, slg, bestSeason: best, longestStreak: streak, survivorExit, titles, qualified: ab >= 50 });
export const TROPHY_ROOM = {
  trophies: [
    { seasonYear: 2026, pickem: [champion("p1", "Gary"), champion("p4", "Rick")], survivor: null, bowl: [champion("p2", "Connor")] },
    { seasonYear: 2025, pickem: [champion("p3", "Tyler")], survivor: [champion("p5", "Zac")], bowl: null },
    { seasonYear: 2024, pickem: [champion("p3", "Tyler")], survivor: null, bowl: null },
  ],
  players: [
    row("p3", "Tyler", 2, 212, 127, 127 / 212, 171 / 212, { year: 2025, avg: 0.634, ab: 118 }, 11, exit(9.5, 2), { pickem: 1, survivor: 0 }),
    row("p1", "Gary", 2, 205, 118, 118 / 205, 160 / 205, { year: 2026, avg: 0.598, ab: 87 }, 9, exit(6, 1), { pickem: 1, survivor: 0 }),
    row("p4", "Rick", 2, 198, 111, 111 / 198, 149 / 198, { year: 2026, avg: 0.571, ab: 82 }, 8, exit(4.5, 2), { pickem: 1, survivor: 0 }),
    row("p2", "Connor", 2, 190, 120, 120 / 190, 150 / 190, { year: 2025, avg: 0.632, ab: 104 }, 7, exit(7, 2), { pickem: 0, survivor: 0 }),
    row("p6", "Ron", 2, 176, 91, 91 / 176, 118 / 176, { year: 2025, avg: 0.531, ab: 96 }, 6, exit(3.5, 2), { pickem: 0, survivor: 0 }),
    row("p7", "Al", 1, 34, 20, 20 / 34, 27 / 34, null, 5, exit(2, 1), { pickem: 0, survivor: 0 }),
    row("p8", "Dana", 1, 12, 5, 5 / 12, 7 / 12, null, 3, null, { pickem: 0, survivor: 0 }),
    row("p5", "Zac", 0, 0, 0, null, null, null, 0, null, { pickem: 0, survivor: 1 }),
  ],
};

/** The group's stats: a pool of eight over two seasons. */
const bucket = (wins, losses) => ({ wins, losses, picks: wins + losses, hitRate: wins / (wins + losses) });
const split = (wins, losses, share) => ({ ...bucket(wins, losses), share });
const teamPicked = (teamId, name, abbreviation, wins, losses, share) => ({ teamId, name, abbreviation, ...bucket(wins, losses), share });
const leagueTeams = [
  teamPicked("kc", "Kansas City Chiefs", "KC", 236, 190, 0.095), teamPicked("buf", "Buffalo Bills", "BUF", 211, 176, 0.086),
  teamPicked("phi", "Philadelphia Eagles", "PHI", 198, 171, 0.082), teamPicked("sf", "San Francisco 49ers", "SF", 187, 169, 0.079), teamPicked("det", "Detroit Lions", "DET", 176, 150, 0.073),
];
/** Pick'em performance: the league, and four players (ids match the Trophy Room fixture, so its streak columns line up). */
export const POOL_STATS = {
  record: { ...bucket(2418, 2077), pushes: 96, pushedGames: 31, pushShare: 0.032 },
  teams: leagueTeams,
  mostPicked: leagueTeams[0],
  bySeason: [{ seasonYear: 2026, ...bucket(1190, 1013) }, { seasonYear: 2025, ...bucket(1228, 1064) }],
  weeks: { total: 1120, donut: 262, split: 548, sweep: 310 },
  streaks: {
    sweeps: [
      { playerId: "p2", name: "Connor", longest: 6, current: 2, endedAt: { seasonYear: 2025, week: 11 } },
      { playerId: "p3", name: "Tyler", longest: 5, current: 0, endedAt: { seasonYear: 2026, week: 8 } },
      { playerId: "p1", name: "Gary", longest: 4, current: 4, endedAt: { seasonYear: 2026, week: 9 } },
      { playerId: "p4", name: "Rick", longest: 3, current: 0, endedAt: { seasonYear: 2025, week: 4 } },
    ],
    noDonut: [
      { playerId: "p3", name: "Tyler", longest: 23, current: 9, endedAt: { seasonYear: 2026, week: 9 } },
      { playerId: "p2", name: "Connor", longest: 17, current: 17, endedAt: { seasonYear: 2026, week: 9 } },
      { playerId: "p1", name: "Gary", longest: 12, current: 0, endedAt: { seasonYear: 2025, week: 14 } },
      { playerId: "p4", name: "Rick", longest: 8, current: 3, endedAt: { seasonYear: 2025, week: 6 } },
    ],
  },
  splits: {
    side: { favorite: split(1310, 1086, 0.532), underdog: split(1108, 991, 0.468) },
    venue: { home: split(1215, 1047, 0.503), away: split(1103, 1004, 0.469), neutral: split(100, 26, 0.028) },
  },
  graded: 4495,
  players: [
    ["p1", "Gary", bucket(612, 498), { donut: 41, split: 118, sweep: 71 }, [4, 4, { seasonYear: 2026, week: 9 }], [12, 0, { seasonYear: 2025, week: 14 }], 0.55, 0.52, "buf", "Buffalo Bills", "BUF"],
    ["p3", "Tyler", bucket(587, 523), { donut: 52, split: 110, sweep: 68 }, [5, 0, { seasonYear: 2026, week: 8 }], [23, 9, { seasonYear: 2026, week: 9 }], 0.49, 0.5, "kc", "Kansas City Chiefs", "KC"],
    ["p4", "Rick", bucket(551, 519), { donut: 58, split: 119, sweep: 53 }, [3, 0, { seasonYear: 2025, week: 4 }], [8, 3, { seasonYear: 2025, week: 6 }], 0.5, 0.49, "phi", "Philadelphia Eagles", "PHI"],
    ["p2", "Connor", bucket(644, 466), { donut: 33, split: 120, sweep: 77 }, [6, 2, { seasonYear: 2025, week: 11 }], [17, 17, { seasonYear: 2026, week: 9 }], 0.57, 0.46, "kc", "Kansas City Chiefs", "KC"],
  ].map(([playerId, name, record, weeks, sweeps, noDonut, favoriteShare, homeShare, teamId, teamName, teamAbbreviation]) => {
    const teams = [teamPicked(teamId, teamName, teamAbbreviation, Math.round(record.wins * 0.11), Math.round(record.losses * 0.1), 0.105), teamPicked("sf", "San Francisco 49ers", "SF", Math.round(record.wins * 0.09), Math.round(record.losses * 0.09), 0.088), teamPicked("det", "Detroit Lions", "DET", Math.round(record.wins * 0.08), Math.round(record.losses * 0.07), 0.074)];
    return {
      playerId, name,
      record: { ...record, pushes: 14, pushedGames: 12, pushShare: 0.011 },
      teams,
      mostPicked: teams[0],
      bySeason: [{ seasonYear: 2026, ...bucket(Math.round(record.wins * 0.5), Math.round(record.losses * 0.5)) }, { seasonYear: 2025, ...bucket(Math.round(record.wins * 0.5), Math.round(record.losses * 0.5)) }],
      weeks: { total: weeks.donut + weeks.split + weeks.sweep, ...weeks },
      streaks: { sweeps: { longest: sweeps[0], current: sweeps[1], endedAt: sweeps[2] }, noDonut: { longest: noDonut[0], current: noDonut[1], endedAt: noDonut[2] } },
      splits: {
        side: { favorite: split(Math.round(record.wins * 0.55), Math.round(record.losses * 0.45), favoriteShare), underdog: split(Math.round(record.wins * 0.45), Math.round(record.losses * 0.55), 1 - favoriteShare) },
        venue: { home: split(Math.round(record.wins * 0.5), Math.round(record.losses * 0.5), homeShare), away: split(Math.round(record.wins * 0.45), Math.round(record.losses * 0.45), 0.95 - homeShare), neutral: split(Math.round(record.wins * 0.05), Math.round(record.losses * 0.05), 0.05) },
      },
      graded: record.picks,
    };
  }),
};
