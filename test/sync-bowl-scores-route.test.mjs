import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

// The Bowl score cron route, run for real: its gates and its own lease around the Bowl sync, with the sync, the season gate and the lease scripted.
const calls = [];
globalThis.bowlSyncFixture = { idle: null, leaseError: null };
const stub = (body) => `data:text/javascript,${encodeURIComponent(body)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      "@/lib/sync-bowl-pool": "export const syncBowlPool = async () => { globalThis.bowlSyncCalls('sync'); return { games: 3 }; };",
      "@/lib/off-season-gate": "export const skipOutsideSeason = async (kind) => { globalThis.bowlSyncCalls('gate:' + kind); return globalThis.bowlSyncFixture.idle; };",
      "@/lib/automation-execution-lease": "export class AutomationAlreadyRunningError extends Error {}; export const runWithAutomationLease = async (name, work) => { globalThis.bowlSyncCalls('lease:' + name); if (globalThis.bowlSyncFixture.leaseError) throw globalThis.bowlSyncFixture.leaseError(AutomationAlreadyRunningError); return work(); };",
    };
    if (mocks[specifier]) return { url: stub(mocks[specifier]), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
globalThis.bowlSyncCalls = (name) => { calls.push(name); };
const { NextRequest } = await import("next/server.js");
const { POST } = await import("../src/app/api/cron/sync-bowl-scores/route.ts");
const post = (token = "Bearer s3cret") => POST(new NextRequest("http://localhost/api/cron/sync-bowl-scores", { method: "POST", headers: token ? { authorization: token } : {} }));
const reset = () => { calls.length = 0; globalThis.bowlSyncFixture.idle = null; globalThis.bowlSyncFixture.leaseError = null; process.env.CRON_SECRET = "s3cret"; };

test("the route refuses a missing secret or a wrong token before doing any work", async () => {
  reset();
  delete process.env.CRON_SECRET;
  assert.equal((await post()).status, 500);
  process.env.CRON_SECRET = "s3cret";
  assert.equal((await post("Bearer nope")).status, 401);
  assert.equal((await post(null)).status, 401);
  assert.deepEqual(calls, []);
});

test("an authorised run checks the Bowl season gate, takes the bowl_scores lease and syncs", async () => {
  reset();
  const response = await post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, bowl: { games: 3 } });
  assert.deepEqual(calls, ["gate:bowl", "lease:bowl_scores", "sync"]);
});

test("outside the Bowl season the route answers with the gate's response and syncs nothing", async () => {
  reset();
  globalThis.bowlSyncFixture.idle = Response.json({ success: true, skipped: true, message: "off-season" });
  assert.equal((await (await post()).json()).skipped, true);
  assert.deepEqual(calls, ["gate:bowl"]);
});

test("a run already holding the lease is a skip, and any other failure is a 500 that says why", async () => {
  reset();
  globalThis.bowlSyncFixture.leaseError = (Already) => new Already("bowl_scores is already running");
  const busy = await post();
  assert.equal(busy.status, 200);
  assert.deepEqual(await busy.json(), { success: true, skipped: true, message: "bowl_scores is already running" });
  globalThis.bowlSyncFixture.leaseError = () => new Error("ESPN unreachable");
  const failed = await post();
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { success: false, error: "ESPN unreachable" });
  assert.ok(!calls.includes("sync"));
});
