import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// How a new watchdog incident reaches the Commissioner: by email and on their phone, each on its own, so either can fail without losing the alert.
const fixture = { database: null, push: null, pushCalls: [], warnings: [] };
globalThis.watchdogNotifyFixture = fixture;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const shim = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
    if (specifier === "@/lib/supabase-admin") return shim("export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.watchdogNotifyFixture.database[name](...args) });");
    if (specifier === "@/lib/player-push") return shim("export const sendPushToPlayers = async (...args) => { globalThis.watchdogNotifyFixture.pushCalls.push(args); return globalThis.watchdogNotifyFixture.push(...args); };");
    if (specifier === "@/lib/operational-warnings") return shim("export const noteOperationalWarning = async (...args) => { globalThis.watchdogNotifyFixture.warnings.push(args); };");
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { notifyCommissioners } = await import("../src/lib/watchdog-notify.ts");

const SIGNAL = { key: "stalled-final-scores", severity: "critical", title: "Final-score automation is stalled", detail: "3 games need a score check." };
const realFetch = globalThis.fetch;
let emailRequests;

function setup({ commissioners = [{ id: "c1", notification_email: "boss@example.com" }], playersError = null, brevo = 200, push = async () => ({ devices: 1, sent: 1, failed: 0, removed: 0 }), brevoKeys = true } = {}) {
  fixture.database = recordingDatabase((table) => { assert.equal(table, "players"); return { data: playersError ? null : commissioners, error: playersError }; });
  fixture.push = push; fixture.pushCalls = []; fixture.warnings = []; emailRequests = [];
  if (brevoKeys) { process.env.BREVO_API_KEY = "fixture-key"; process.env.BREVO_SENDER_EMAIL = "sender@example.com"; }
  else { delete process.env.BREVO_API_KEY; delete process.env.BREVO_SENDER_EMAIL; }
  globalThis.fetch = async (url, init) => { emailRequests.push({ url, body: JSON.parse(init.body) }); return { ok: brevo === 200, status: brevo }; };
}
const finish = () => { globalThis.fetch = realFetch; };

test("a new incident goes to the Commissioner's email and phone, and nothing is raised when both work", async () => {
  setup();
  try { assert.equal(await notifyCommissioners(SIGNAL), 1); } finally { finish(); }
  assert.equal(emailRequests.length, 1);
  assert.deepEqual(emailRequests[0].body.to, [{ email: "boss@example.com" }]);
  assert.equal(emailRequests[0].body.subject, "[Pick'em action needed] Final-score automation is stalled");
  const [playerIds, payload] = fixture.pushCalls[0];
  assert.deepEqual(playerIds, ["c1"]);
  assert.deepEqual(payload, { title: "Pick'em action needed", body: "Final-score automation is stalled. 3 games need a score check.", url: "/admin", tag: "watchdog-stalled-final-scores" });
  assert.deepEqual(fixture.warnings, []);
});

test("when the email fails the phone still delivers the alert, and the failed email is raised as a warning", async () => {
  setup({ brevo: 401 });
  try { assert.equal(await notifyCommissioners(SIGNAL), 1, "counted as delivered through the phone"); } finally { finish(); }
  assert.deepEqual(fixture.warnings, [["watchdog", "A watchdog alert email could not be sent.", { signalKey: "stalled-final-scores", reason: "Commissioner alert email was rejected (401)." }]]);
});

test("a lapsed or missing email setup is no different: the phone carries the alert and the problem is raised", async () => {
  setup({ brevoKeys: false });
  try { await notifyCommissioners(SIGNAL); } finally { finish(); }
  assert.equal(emailRequests.length, 0);
  assert.deepEqual(fixture.warnings.map(([, message, details]) => [message, details.reason]), [["A watchdog alert email could not be sent.", "Commissioner alert email is not configured."]]);
});

test("when the phone fails the email still delivers the alert, and the failed phone alert is raised as a warning", async () => {
  for (const push of [async () => { throw new Error("The player's devices could not be read."); }, async () => ({ devices: 2, sent: 0, failed: 2, removed: 0 })]) {
    setup({ push });
    try { assert.equal(await notifyCommissioners(SIGNAL), 1); } finally { finish(); }
    assert.deepEqual(fixture.warnings.map(([, message]) => message), ["A watchdog alert phone notification could not be sent."]);
  }
});

test("a Commissioner with no phone set up is not a failure: the email goes and nothing is raised", async () => {
  setup({ push: async () => ({ devices: 0, sent: 0, failed: 0, removed: 0 }) });
  try { assert.equal(await notifyCommissioners(SIGNAL), 1); } finally { finish(); }
  assert.deepEqual(fixture.warnings, []);
});

test("only when both fail does the alert fail, with the email's reason, so the watchdog retries it", async () => {
  setup({ brevo: 500, push: async () => ({ devices: 1, sent: 0, failed: 1, removed: 0 }) });
  try { await assert.rejects(notifyCommissioners(SIGNAL), /Commissioner alert email was rejected \(500\)\./); } finally { finish(); }
  assert.equal(fixture.warnings.length, 2, "both failures are raised");

  setup({ brevo: 500, push: async () => ({ devices: 0, sent: 0, failed: 0, removed: 0 }) });
  try { await assert.rejects(notifyCommissioners(SIGNAL), /rejected \(500\)/, "a failed email and no phone at all is a failed alert"); } finally { finish(); }
});

test("the phone message is cut to a few lines, and the Commissioner list failing stops the alert", async () => {
  setup();
  try { await notifyCommissioners({ ...SIGNAL, detail: "x".repeat(400) }); } finally { finish(); }
  const body = fixture.pushCalls[0][1].body;
  assert.equal(body.length, 180);
  assert.ok(body.endsWith("…"));

  setup({ playersError: { message: "down" } });
  try { await assert.rejects(notifyCommissioners(SIGNAL), /recipients could not be loaded/); } finally { finish(); }
  assert.equal(emailRequests.length, 0);
});
