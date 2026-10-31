import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// Bowl health on and after launch day (Dec 7, 3 AM Eastern): the College Football Playoff rounds after the first have no teams until earlier rounds finish,
// and that must not turn the health monitor, the deploy check and the watchdog red for six weeks. A real problem still must, and each kind of problem alerts on its own.
const SEASON = { id: "season-1", player_visible_at: "2026-12-07T08:00:00Z" };
const game = (id, bowl, kickoff, over = {}) => ({ id, bowl_name: bowl, kickoff_at: kickoff, order_index: 0, status: "scheduled", away_team_id: "a", home_team_id: "b", is_cfp: false, ...over });
const SCHEDULE = [
  game("frisco", "Frisco Bowl", "2026-12-19T17:30:00Z", { order_index: 1 }),
  game("rose", "Rose Bowl", "2027-01-01T22:00:00Z", { order_index: 2, is_cfp: true, away_team_id: "a", home_team_id: null }),
  game("sugar", "Sugar Bowl", "2027-01-01T22:00:00Z", { order_index: 3, is_cfp: true, away_team_id: null, home_team_id: null }),
  game("title", "National Championship", "2027-01-26T00:30:00Z", { order_index: 4, is_cfp: true, away_team_id: null, home_team_id: null }),
];
let games;
const respond = (table, calls) => {
  const one = calls.some(([name]) => name === "maybeSingle");
  if (table === "bowl_pool_seasons") return { data: SEASON, error: null };
  if (table === "bowl_pool_games") return { data: games, error: null };
  if (table === "bowl_pool_game_lines") return { data: games.map((item) => ({ game_id: item.id })), error: null };
  if (one) return { data: null, error: null };
  return { data: [], error: null };
};
globalThis.bowlHealthFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlHealthFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { checkBowlPoolHealth } = await import("../src/lib/bowl-pool-health.ts");
const { assessBowlPoolIntegrity } = await import("../src/lib/bowl-pool-integrity.js");
const { evaluateWatchdogSignals } = await import("../src/lib/watchdog-rules.js");

const healthAt = async (now, schedule = SCHEDULE) => {
  games = schedule; bowlHealthFixture.database = recordingDatabase(respond);
  mock.timers.enable({ apis: ["Date"], now: Date.parse(now) });
  try { return await checkBowlPoolHealth(); } finally { mock.timers.reset(); }
};

test("launch day with the later playoff rounds still waiting for teams is healthy, until a playoff game is within 36 hours of kickoff", async () => {
  for (const now of ["2026-12-07T08:00:00Z", "2026-12-20T00:00:00Z", "2026-12-31T09:00:00Z"]) {
    const health = await healthAt(now);
    assert.deepEqual({ healthy: health.healthy, problems: health.problems }, { healthy: true, problems: [] }, now);
  }
  const close = await healthAt("2026-12-31T12:00:00Z");
  assert.equal(close.healthy, false);
  assert.deepEqual(close.problems, ["Rose Bowl (Jan 1) is missing a team.", "Sugar Bowl (Jan 1) is missing a team."]);
  assert.deepEqual([...new Set(close.issues.map((issue) => issue.kind))], ["teams"]);
});

test("an ordinary bowl without its teams is a problem at once, named by bowl and date; a finished or postponed playoff game is not asked for teams", async () => {
  const teamless = SCHEDULE.map((item) => item.id === "frisco" ? { ...item, home_team_id: null } : item);
  assert.deepEqual((await healthAt("2026-12-07T08:00:00Z", teamless)).problems, ["Frisco Bowl (Dec 19) is missing a team."]);
  const late = new Date("2027-01-26T12:00:00Z");
  const result = assessBowlPoolIntegrity(SCHEDULE.map((item) => item.is_cfp ? { ...item, status: "postponed" } : item), [{ game_id: "frisco" }], late);
  assert.deepEqual(result.problems, []);
});

test("a started game with no official line names the game, and each kind of problem is its own alert so a new kind is not hidden by an old one", () => {
  const issues = assessBowlPoolIntegrity([SCHEDULE[0], { ...SCHEDULE[1], home_team_id: "b" }], [], new Date("2027-01-01T23:00:00Z")).issues;
  assert.deepEqual(issues.map((issue) => issue.kind), ["line"], "one line issue naming the started games");
  assert.match(issues.find((issue) => issue.kind === "line").message, /Frisco Bowl \(Dec 19\), Rose Bowl \(Jan 1\) have started without a locked line\./);

  const alerts = (bowlHealth) => evaluateWatchdogSignals({ health: { missingOfficialLines: 0, latestScores: null, providerAllowance: null, scoreChecksDueNow: 0, scoreProviderFailureStreak: 0, pendingScheduleReviews: 0, pinAttackIncidents: [], reminderHealth: { overdueScheduled: 0, staleSending: 0 } }, bootstrap: {}, bowlHealth }).filter((signal) => signal.key.startsWith("bowl-pool-"));
  const teams = { kind: "teams", message: "Rose Bowl (Jan 1) is missing a team." };
  const line = { kind: "line", message: "Rose Bowl (Jan 1) has started without a locked line." };
  assert.deepEqual(alerts({ configured: true, healthy: false, problems: [teams.message], issues: [teams] }).map((signal) => signal.key), ["bowl-pool-teams-needs-review"]);
  assert.deepEqual(alerts({ configured: true, healthy: false, problems: [teams.message, line.message], issues: [teams, line] }).map((signal) => signal.key), ["bowl-pool-teams-needs-review", "bowl-pool-line-needs-review"]);
  const [only] = alerts({ configured: true, healthy: false, problems: [line.message], issues: [line] });
  assert.equal(only.title, "A started Bowl Pool game has no official line");
  assert.match(only.detail, /Rose Bowl \(Jan 1\) has started without a locked line\. Open Commissioner Desk/);
  assert.deepEqual(alerts({ configured: true, healthy: false, problems: ["Something odd."] }).map((signal) => signal.key), ["bowl-pool-integrity-needs-review"], "a result with no kinds keeps the single alert");
  assert.deepEqual(alerts({ configured: true, healthy: true, problems: [] }), []);
});
