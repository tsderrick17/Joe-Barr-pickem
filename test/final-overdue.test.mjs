import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";
import { FINAL_OVERDUE_HOURS, finalIsOverdue } from "../src/lib/final-overdue.js";
import { FINAL_SCORE_POLLING_LIMIT_HOURS, isDueForFinalScoreCheck } from "../src/lib/score-window.js";
import { evaluateWatchdogSignals } from "../src/lib/watchdog-rules.js";

// "A game has no final score long after kickoff" is one rule for both pools: the same cut-off for the NFL alert, the Bowl alert and the Bowl Card's
// "Final score pending". NFL score checks stop at the polling limit and the game is raised to the Commissioner instead.
const NOW = new Date("2026-09-14T12:00:00Z");
const hoursAgo = (hours) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

test("a game is overdue six hours after kickoff while still scheduled or live, and never once it is settled or called off", () => {
  assert.equal(FINAL_OVERDUE_HOURS, 6);
  assert.equal(finalIsOverdue({ status: "live", kickoff_at: hoursAgo(5.99) }, NOW), false);
  assert.equal(finalIsOverdue({ status: "live", kickoff_at: hoursAgo(6) }, NOW), true);
  assert.equal(finalIsOverdue({ status: "scheduled", kickoff_at: hoursAgo(30) }, NOW), true);
  for (const status of ["final", "postponed", "cancelled", "no_contest"]) assert.equal(finalIsOverdue({ status, kickoff_at: hoursAgo(30) }, NOW), false, status);
  assert.equal(finalIsOverdue({ status: "live", kickoff_at: "not a date" }, NOW), false);
});

test("NFL score checks start 170 minutes after kickoff and stop 72 hours after it", () => {
  assert.equal(FINAL_SCORE_POLLING_LIMIT_HOURS, 72);
  const due = (kickoffAt) => isDueForFinalScoreCheck({ kickoffAt, status: "live" }, NOW);
  assert.equal(due(hoursAgo(2.5)), false, "too early");
  assert.equal(due(hoursAgo(3)), true);
  assert.equal(due(hoursAgo(71.9)), true, "still worth a credit");
  assert.equal(due(hoursAgo(72)), false, "the provider no longer returns it: no more credits spent");
  assert.equal(due(hoursAgo(200)), false);
});

test("the watchdog raises one NFL incident naming every overdue game, and none when there are none", () => {
  const health = (overdueFinals) => ({
    missingOfficialLines: 0, scoreChecksDueNow: 0, scoreCandidates: 0, scoreProviderFailureStreak: 0, providerAllowance: 100,
    latestScores: { status: "success", started_at: "2026-09-14T11:50:00Z", completed_at: "2026-09-14T11:51:00Z" },
    reminderHealth: { overdueScheduled: 0, staleSending: 0 }, pendingScheduleReviews: 0, scheduleProviderCircuit: null, pinAttackIncidents: [], overdueFinals,
  });
  const signals = (overdueFinals) => evaluateWatchdogSignals({ health: health(overdueFinals), bootstrap: { seasonYear: 2026, loadedGames: 272, complete: true, seasonState: "in_season" }, preflightChecks: [], now: NOW });
  assert.deepEqual(signals([]), []);
  assert.deepEqual(signals(undefined), [], "a health report from before this check existed raises nothing");
  const [incident, ...others] = signals([{ id: "g1", label: "NYJ at BUF (Sep 10)" }, { id: "g2", label: "DAL at PHI (Sep 11)" }]);
  assert.deepEqual(others, []);
  assert.equal(incident.key, "final-overdue-nfl");
  assert.equal(incident.severity, "critical");
  assert.match(incident.detail, /NYJ at BUF \(Sep 10\), DAL at PHI \(Sep 11\) have no final score 6\+ hours after kickoff/);
});

// The real NFL health check over a scripted database that applies the date filters it is given.
const GAMES = [
  { id: "recent", status: "scheduled", kickoff_at: hoursAgo(5), line_lock_at: hoursAgo(30), away_team_id: "t1", home_team_id: "t2" },
  { id: "late", status: "live", kickoff_at: hoursAgo(7), line_lock_at: hoursAgo(30), away_team_id: "t1", home_team_id: "t2" },
  { id: "abandoned", status: "scheduled", kickoff_at: hoursAgo(80), line_lock_at: hoursAgo(100), away_team_id: "t3", home_team_id: "t2" },
  { id: "done", status: "final", kickoff_at: hoursAgo(26), line_lock_at: hoursAgo(50), away_team_id: "t1", home_team_id: "t2" },
];
const respond = (table, calls) => {
  const arg = (method) => calls.find(([name]) => name === method)?.[1];
  if (table === "games") {
    let rows = GAMES.filter((game) => arg("in")[1].includes(game.status));
    for (const [name, args] of calls) {
      if (name === "lte") rows = rows.filter((game) => game[args[0]] <= args[1]);
      if (name === "gte") rows = rows.filter((game) => game[args[0]] >= args[1]);
    }
    return { data: rows, error: null };
  }
  if (table === "teams") return { data: [{ id: "t1", abbreviation: "NYJ" }, { id: "t2", abbreviation: "BUF" }, { id: "t3", abbreviation: "DAL" }], error: null };
  if (table === "provider_failure_circuits") return { data: null, error: null };
  if (["schedule_change_reviews", "sync_runs", "email_reminder_deliveries", "push_reminder_deliveries"].includes(table) && calls.some(([name, args]) => name === "select" && args[1]?.head)) return { count: 0, data: null, error: null };
  return { data: [], error: null };
};
globalThis.nflHealthFixture = { database: recordingDatabase(respond) };
registerHooks({
  resolve(specifier, context, nextResolve) {
    const shim = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
    if (specifier === "@/lib/supabase-admin") return shim("export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.nflHealthFixture.database[name](...args) });");
    if (specifier === "@/lib/reminder-health") return shim("export const checkReminderHealth = async () => ({ problems: [], overdueScheduled: 0, staleSending: 0 });");
    if (specifier === "@/lib/critical-worker-health") return shim("export const checkCriticalWorkerHealth = async () => ({ messages: [], problems: [] });");
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { checkAutomationHealth } = await import("../src/lib/automation-health.ts");

test("NFL health names every game with no final long after kickoff, and counts as score candidates only the games still being polled", async () => {
  const health = await checkAutomationHealth(NOW);
  assert.deepEqual(health.overdueFinals.map((game) => ({ id: game.id, label: game.label })), [
    { id: "late", label: "NYJ at BUF (Sep 14)" },
    { id: "abandoned", label: "DAL at BUF (Sep 11)" },
  ]);
  assert.equal(health.scoreCandidates, 2, "the abandoned game is past the polling limit: it is raised as overdue, not counted as a pending check");
  assert.ok(health.problems.includes(`2 games have no final score yet, more than ${FINAL_OVERDUE_HOURS} hours after kickoff.`));
  assert.equal(health.status, "attention");
});
