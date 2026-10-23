import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The launch preflight, run end to end with its database scripted and the network stubbed: it must verify every external game-day dependency with
// read-only requests (nothing sent, nothing imported, no provider credits spent), and say which check failed when one does.
const env = {
  ODDS_API_KEY: "odds-key", BREVO_API_KEY: "brevo-key", BREVO_SENDER_EMAIL: "Pool@Example.com", CRON_SECRET: "cron-secret",
  PLAYER_AUTH_PEPPER: "p".repeat(32),
};
const good = () => ({
  fallback: false, source: "SUPABASE_SERVICE_ROLE_KEY", cronMatches: true,
  commissioners: [{ notification_email: "boss@example.com" }],
  heartbeat: { last_succeeded_at: new Date().toISOString(), last_failed_at: null },
  senders: [{ email: "pool@example.com", active: true }], sports: [{ key: "americanfootball_nfl" }],
});
let world = good();
const requests = [];
const respond = (table) => {
  if (table === "seasons") return { data: [{ id: "s" }], error: null };
  if (table === "players") return { data: world.commissioners, error: null };
  if (table === "automation_worker_heartbeats") return { data: world.heartbeat, error: null };
  return { data: null, error: null };
};
const database = () => recordingDatabase(respond, { rpc: (name) => (name === "automation_cron_secret_matches" ? { data: world.cronMatches, error: null } : { data: [{ check_id: "line-locks", label: "Line locks", passed: true, detail: "ok" }], error: null }) });
globalThis.preflightFixture = { database: database(), state: () => ({ source: world.fallback ? "SUPABASE_SECRET_KEY" : "SUPABASE_SERVICE_ROLE_KEY", fallback: world.fallback }) };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.preflightFixture.database[name](...args) });export const supabaseServerCredentialSource = 'SUPABASE_SERVICE_ROLE_KEY';export const supabaseServerCredentialUsesFallback = false;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), method: options.method ?? "GET" });
  if (String(url).includes("the-odds-api.com")) return new Response(JSON.stringify(world.sports), { status: 200 });
  if (String(url).includes("api.brevo.com")) return new Response(JSON.stringify({ senders: world.senders }), { status: 200 });
  throw new Error(`unexpected request to ${url}`);
};
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { runLaunchPreflight } = await import("../src/lib/launch-preflight.ts");
const run = async (changes = {}, environment = {}) => {
  world = { ...good(), ...changes }; requests.length = 0;
  globalThis.preflightFixture.database = database();
  const saved = { ...process.env };
  Object.assign(process.env, env, environment);
  for (const [key, value] of Object.entries(environment)) if (value === undefined) delete process.env[key];
  try { return await runLaunchPreflight(); } finally { for (const key of Object.keys(env)) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } }
};
const failed = (result) => result.checks.filter((item) => !item.passed).map((item) => item.check_id).sort();

test("with everything configured the preflight is healthy, and it only reads: no email, no import, no odds spend", async () => {
  const result = await run();
  assert.equal(result.status, "healthy", JSON.stringify(failed(result)));
  assert.ok(requests.length >= 2 && requests.every((request) => request.method === "GET"), "only read requests");
  const hosts = requests.map((request) => new URL(request.url).host).sort();
  assert.deepEqual([...new Set(hosts)], ["api.brevo.com", "api.the-odds-api.com"]);
  const odds = requests.find((request) => request.url.includes("the-odds-api.com")).url;
  assert.match(odds, /\/v4\/sports\/\?/, "the zero-credit sports list, not the odds");
  assert.match(odds, /all=true/);
  assert.ok(requests.some((request) => request.url === "https://api.brevo.com/v3/senders"), "senders are listed, never sent through");
});

test("each missing or wrong piece of configuration is named by its own failing check", async () => {
  assert.deepEqual(failed(await run({}, { ODDS_API_KEY: undefined })), ["odds-provider"]);
  assert.deepEqual(failed(await run({ sports: [{ key: "basketball" }] })), ["odds-provider"], "a key that cannot see the NFL feed");
  assert.deepEqual(failed(await run({ senders: [{ email: "pool@example.com", active: false }] })), ["brevo-sender"], "an inactive sender");
  assert.deepEqual(failed(await run({ senders: [] })), ["brevo-sender"]);
  assert.deepEqual(failed(await run({}, { BREVO_API_KEY: undefined })), ["brevo-api", "brevo-sender"]);
  assert.deepEqual(failed(await run({ cronMatches: false })), ["cron-authorization"]);
  assert.deepEqual(failed(await run({}, { CRON_SECRET: undefined })), ["cron-authorization"]);
  assert.deepEqual(failed(await run({}, { PLAYER_AUTH_PEPPER: "short" })), ["player-auth-credential"]);
  assert.deepEqual(failed(await run({ commissioners: [{ notification_email: "not-an-address" }] })), ["commissioner-alert-address"]);
  assert.deepEqual(failed(await run({ heartbeat: { last_succeeded_at: new Date(Date.now() - 3_600_000).toISOString() } })), ["watchdog-heartbeat"], "a watchdog silent for an hour");
});
