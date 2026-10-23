import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The Grading dashboard's route, run against a scripted database: what it answers is what the dashboard draws, so the answer's shape is the contract.
const NOW = Date.parse("2026-10-04T18:30:00Z");
const SEASON = { id: "season-1", year: 2026 };
const PERIOD = { id: "p5", display_name: "Week 5", display_order: 5, status: "active", period_type: "regular", season_id: "season-1" };
const GAME = { id: "g1", scoring_period_id: "p5", kickoff_at: "2026-10-04T17:00:00Z", status: "live", finalized_at: null, home_team_id: "t1", away_team_id: "t2", home_score: 7, away_score: 3 };
let reads = [];
const database = () => globalThis.gradingFixture.database;
const respond = (table, calls) => {
  reads.push(table);
  const single = calls.some(([name]) => name === "maybeSingle" || name === "single");
  const rows = { seasons: [SEASON], scoring_periods: [PERIOD], games: [GAME] }[table] ?? [];
  return { data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length };
};
let allowed = true;
globalThis.gradingFixture = { database: recordingDatabase(respond, { rpc: () => ({ data: [], error: null }) }) };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/require-commissioner") return { url: "data:text/javascript,export const commissionerAccess = async () => globalThis.gradingAccess();", shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.gradingFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
globalThis.gradingAccess = () => (allowed ? { ok: true, player: { id: "c1", is_commissioner: true } } : { ok: false, status: 403, code: "not_commissioner" });
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { NextRequest } = await import("next/server.js");
const { GET } = await import("../src/app/api/admin/grading-dashboard/route.ts");
const request = () => new NextRequest("http://localhost/api/admin/grading-dashboard");

test("a request that is not the Commissioner's is refused before anything is read", async () => {
  allowed = false; reads = [];
  const response = await GET(request());
  assert.equal(response.status, 403);
  assert.deepEqual(reads, []);
  allowed = true;
});

test("the Commissioner gets the pipeline, attention queue, workers, polling and efficiency figures the dashboard draws", async () => {
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const response = await GET(request());
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json();
    for (const key of ["checkedAt", "status", "periods", "period", "metrics", "games", "attention", "audit", "workerRuns", "cadence", "scorePolls", "ladderSummary", "ladderCoverage", "creditUsage", "incidents", "reminders"]) {
      assert.ok(key in body, `the answer carries ${key}`);
    }
    assert.equal(body.period.displayName, "Week 5");
    assert.equal(body.games.length, 1);
    // Worker activity covers every worker, and the "last score sync" reads score runs only, so a line-lock or Bowl run can never stand in for it.
    const syncJobs = database().queries.filter((query) => query.table === "sync_runs").flatMap((query) => query.calls.filter(([name, args]) => name === "eq" && args[0] === "job_type").map(([, args]) => args[1]));
    for (const job of ["scores", "line_locks", "bowl_scores"]) assert.ok(syncJobs.includes(job), `the latest ${job} run is read`);
  } finally { Date.now = realNow; }
});
