import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// What a worker's warning turns into: a log line, one saved row per job and wording, and one Sentry warning when it is new (or back after 12 quiet hours).
// Whatever goes wrong while saving or reporting, the worker that raised it carries on.
const sentryMessages = [];
globalThis.warningFixture = { database: null, sentryFails: false };
registerHooks({
  resolve(specifier, context, nextResolve) {
    const shim = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
    if (specifier === "@/lib/supabase-admin") return shim("export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.warningFixture.database[name](...args) });");
    if (specifier === "@sentry/nextjs") return shim("export const captureMessage = (...args) => { if (globalThis.warningFixture.sentryFails) throw new Error('sentry down'); globalThis.sentryMessages.push(args); };");
    return nextResolve(specifier, context);
  },
});
globalThis.sentryMessages = sentryMessages;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { noteOperationalWarning, resetOperationalWarningMemo } = await import("../src/lib/operational-warnings.ts");

const realWarn = console.warn;
const realError = console.error;
let logged;
function start(rpc) {
  resetOperationalWarningMemo();
  sentryMessages.length = 0;
  warningFixture.sentryFails = false;
  warningFixture.database = recordingDatabase(() => ({ data: null, error: null }), { rpc });
  logged = [];
  console.warn = (...args) => logged.push(["warn", ...args]);
  console.error = (...args) => logged.push(["error", ...args]);
}
const finish = () => { console.warn = realWarn; console.error = realError; };
const saved = () => warningFixture.database.rpcCalls.filter((call) => call.name === "record_operational_warning");

test("a new warning is logged, saved once with its details, and sent to Sentry as a warning tagged with the job", async () => {
  start(() => ({ data: true, error: null }));
  try {
    await noteOperationalWarning("bowl_scores", "Bowl Pool games ESPN no longer lists.", { games: ["Cure Bowl"] });
  } finally { finish(); }
  assert.deepEqual(logged, [["warn", "Bowl Pool games ESPN no longer lists.", { games: ["Cure Bowl"] }]], "the log line the runbook points to is still written");
  assert.deepEqual(saved().map((call) => call.args), [{ target_job: "bowl_scores", target_message: "Bowl Pool games ESPN no longer lists.", target_details: { games: ["Cure Bowl"] } }]);
  assert.deepEqual(sentryMessages, [["Bowl Pool games ESPN no longer lists.", { level: "warning", tags: { job: "bowl_scores" }, extra: { games: ["Cure Bowl"] } }]]);
});

test("the same warning raised again and again is saved and reported once, but another wording is its own warning", async () => {
  start(() => ({ data: true, error: null }));
  try {
    for (let game = 0; game < 40; game += 1) await noteOperationalWarning("bowl_scores", "A Bowl Pool line-history snapshot could not be saved.", { gameId: `g${game}` });
    await noteOperationalWarning("bowl_scores", "A Bowl Pool game could not be updated.", { gameId: "g1" });
    await noteOperationalWarning("scores", "A Bowl Pool line-history snapshot could not be saved.");
  } finally { finish(); }
  assert.equal(logged.length, 42, "every occurrence is still logged");
  assert.deepEqual(saved().map((call) => [call.args.target_job, call.args.target_message, call.args.target_details]), [
    ["bowl_scores", "A Bowl Pool line-history snapshot could not be saved.", { gameId: "g0" }],
    ["bowl_scores", "A Bowl Pool game could not be updated.", { gameId: "g1" }],
    ["scores", "A Bowl Pool line-history snapshot could not be saved.", {}],
  ]);
  assert.equal(sentryMessages.length, 3);
});

test("a warning the database already knows about (seen within 12 hours) is saved but not sent to Sentry again", async () => {
  start(() => ({ data: false, error: null }));
  try { await noteOperationalWarning("reminders", "Phone notifications for a reminder could not be sent.", { reminderId: "r1" }); } finally { finish(); }
  assert.equal(saved().length, 1, "the count and last-seen time still move");
  assert.deepEqual(sentryMessages, []);
});

test("when the warning cannot be saved it is still reported to Sentry, and the worker is never interrupted", async () => {
  for (const rpc of [() => ({ data: null, error: { message: "database unreachable" } }), () => { throw new Error("network down"); }]) {
    start(rpc);
    try { await noteOperationalWarning("watchdog", "A sent watchdog alert receipt could not be saved.", { signalKey: "k" }); } finally { finish(); }
    assert.equal(sentryMessages.length, 1);
    assert.deepEqual(logged.map(([level]) => level), ["warn", "error"]);
  }
});

test("a Sentry failure changes nothing for the worker", async () => {
  start(() => ({ data: true, error: null }));
  warningFixture.sentryFails = true;
  try { await noteOperationalWarning("scores", "The score worker's next wake-up time could not be recorded; the hourly safety run will wake it."); } finally { finish(); }
  assert.equal(saved().length, 1);
});
