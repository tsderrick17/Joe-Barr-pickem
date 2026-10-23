import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The annual turnover's two steps, run for real against a scripted database: the Eastern-time boundary first, then the certified cleanup, and what each does when it cannot be verified.
let database, rpcResults, rows;
const respond = (table) => {
  const data = rows[table];
  if (data instanceof Error) return { data: null, error: data };
  return { data: data ?? null, error: null, count: Array.isArray(data) ? data.length : 0 };
};
const rpc = (name) => rpcResults[name] ?? { data: null, error: null };
globalThis.rolloverFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.rolloverFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { ensureAnnualSeasonRollover } = await import("../src/lib/season-rollover.ts");
const { getSeasonBootstrapStatus } = await import("../src/lib/full-schedule-bootstrap.ts");
const setup = ({ results = {}, tables = {} } = {}) => { rpcResults = results; rows = tables; database = recordingDatabase(respond, { rpc }); globalThis.rolloverFixture.database = database; };
const COMPLETED = { status: "completed", targetYear: 2026, blockers: [], preserved: { games: 272 }, deleted: { scratch: 4 }, retry: false };

test("the boundary is made first, then the cleanup runs, both for the same evaluation time", async () => {
  setup({ results: { perform_annual_season_turnover: { data: COMPLETED, error: null } } });
  const result = await ensureAnnualSeasonRollover("2026-08-20T12:00:00Z");
  assert.deepEqual(database.rpcCalls.map((call) => call.name), ["ensure_annual_season_rollover", "perform_annual_season_turnover"]);
  assert.ok(database.rpcCalls.every((call) => call.args.evaluated_at === "2026-08-20T12:00:00Z"));
  assert.deepEqual(result, COMPLETED);
});

test("a blocked cleanup is returned, not thrown: the new season keeps loading while the blockers wait for review", async () => {
  const blocked = { ...COMPLETED, status: "blocked", blockers: ["The previous season is not marked complete."], retry: true };
  setup({ results: { perform_annual_season_turnover: { data: blocked, error: null } } });
  assert.deepEqual(await ensureAnnualSeasonRollover("2026-08-20T12:00:00Z"), blocked);
});

test("if the boundary cannot be verified the cleanup never runs, and a cleanup that cannot be verified is an error", async () => {
  setup({ results: { ensure_annual_season_rollover: { data: null, error: new Error("boom") } } });
  await assert.rejects(ensureAnnualSeasonRollover("2026-08-20T12:00:00Z"), /handoff could not be verified safely/);
  assert.deepEqual(database.rpcCalls.map((call) => call.name), ["ensure_annual_season_rollover"], "the cleanup was not attempted");
  setup({ results: { perform_annual_season_turnover: { data: null, error: new Error("boom") } } });
  await assert.rejects(ensureAnnualSeasonRollover("2026-08-20T12:00:00Z"), /cleanup could not be verified safely/);
  setup({ results: { perform_annual_season_turnover: { data: null, error: null } } });
  await assert.rejects(ensureAnnualSeasonRollover("2026-08-20T12:00:00Z"), /cleanup could not be verified safely/, "an empty answer is not a certificate");
});

test("the bootstrap status reports the turnover record for the season being loaded, before and after its games exist", async () => {
  const turnover = { status: "completed", completed_at: "2026-08-20T12:00:05Z", blockers: [], preserved_counts: { games: 272 }, deleted_counts: { scratch: 4 } };
  setup({ tables: { seasons: { id: "s26", state: "preseason" }, sync_runs: null, season_turnover_runs: turnover, scoring_periods: [] } });
  const status = await getSeasonBootstrapStatus(new Date("2026-08-20T12:10:00Z"));
  assert.equal(status.seasonYear, 2026);
  assert.deepEqual(status.turnover, turnover);
  const turnoverQuery = database.queries.find((query) => query.table === "season_turnover_runs");
  assert.deepEqual(turnoverQuery.calls.find(([name]) => name === "eq")[1], ["target_year", 2026], "the record for this season's year");
  setup({ tables: { seasons: null, sync_runs: null, season_turnover_runs: turnover } });
  const early = await getSeasonBootstrapStatus(new Date("2026-08-20T12:10:00Z"));
  assert.deepEqual([early.seasonId, early.loadedGames, early.complete], [null, 0, false], "no season row yet");
  assert.deepEqual(early.turnover, turnover, "the turnover record is still shown");
  setup({ tables: { seasons: null, sync_runs: null, season_turnover_runs: new Error("down") } });
  await assert.rejects(getSeasonBootstrapStatus(new Date("2026-08-20T12:10:00Z")), /status could not be loaded/);
});
