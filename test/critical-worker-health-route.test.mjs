import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The public worker-health route, run for real with the worker check and the probe-state table scripted: it answers 200 or 503 with nothing but a status and a time,
// waits ten minutes of continuous trouble before it says "unavailable", remembers when trouble began, and an error reading its own state is also "unavailable".
const NOW = new Date("2026-09-13T16:00:00Z");
let health, priorState, stateError, database;
const respond = (table, calls) => {
  if (table !== "health_probe_states") throw new Error(`unexpected table ${table}`);
  if (calls.some(([name]) => name === "maybeSingle")) return { data: priorState, error: stateError };
  return { data: null, error: null };
};
globalThis.workerHealthFixture = { database: null, check: async () => health };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.workerHealthFixture.database[name](...args) });", shortCircuit: true };
    if (specifier === "@/lib/critical-worker-health") return { url: "data:text/javascript,export const checkCriticalWorkerHealth = (...args) => globalThis.workerHealthFixture.check(...args);", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { GET } = await import("../src/app/api/health/workers/route.ts");
const PROBLEMS = [{ jobName: "line_locks", reason: "stale" }];
const check = async ({ healthy = true, since = null, failState = null } = {}) => {
  health = { healthy, problems: healthy ? [] : PROBLEMS };
  priorState = since ? { unhealthy_since: since } : null; stateError = failState;
  database = recordingDatabase(respond); workerHealthFixture.database = database;
  const logged = [];
  mock.method(console, "error", (...args) => logged.push(args));
  mock.timers.enable({ apis: ["Date"], now: NOW });
  try {
    const response = await GET();
    return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control"), logged };
  } finally { mock.timers.reset(); mock.restoreAll(); }
};
const saved = () => database.queries.flatMap((query) => query.calls.filter(([name]) => name === "upsert").map(([, args]) => args[0]));

test("healthy workers answer 200 with only a status and a time, and clear any recorded trouble", async () => {
  const result = await check({ since: "2026-09-13T15:00:00Z" });
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body).sort(), ["checkedAt", "status"]);
  assert.equal(result.body.status, "ok");
  assert.equal(saved()[0].unhealthy_since, null, "trouble is forgotten once the workers are healthy");
  assert.equal(saved()[0].probe_name, "critical_workers");
});

test("the first sign of trouble is remembered but still answers 200: one delayed worker is not an outage", async () => {
  const result = await check({ healthy: false });
  assert.equal(result.status, 200);
  assert.equal(saved()[0].unhealthy_since, NOW.toISOString(), "the moment trouble began is saved");
  const lingering = await check({ healthy: false, since: "2026-09-13T15:55:00Z" });
  assert.equal(lingering.status, 200, "five minutes in is still within the allowance");
  assert.equal(saved()[0].unhealthy_since, "2026-09-13T15:55:00Z", "and the original start is kept, not reset");
});

test("trouble that lasts ten minutes answers 503 with an opaque body, and the detail goes to the log only", async () => {
  const result = await check({ healthy: false, since: "2026-09-13T15:49:00Z" });
  assert.equal(result.status, 503);
  assert.deepEqual(Object.keys(result.body).sort(), ["checkedAt", "status"]);
  assert.equal(result.body.status, "unavailable");
  assert.ok(!JSON.stringify(result.body).includes("line_locks") && !JSON.stringify(result.body).includes("stale"), "no job names or reasons are exposed");
  assert.ok(JSON.stringify(result.logged).includes("line_locks"), "they are logged for the Commissioner instead");
  assert.match(result.cache, /no-store|max-age=0|s-maxage/);
});

test("an error reading the saved state is an unavailable answer, never a healthy one", async () => {
  const result = await check({ failState: new Error("down") });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { status: "unavailable", checkedAt: NOW.toISOString() });
  assert.equal(result.cache, "no-store, max-age=0");
});
