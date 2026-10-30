import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// PIN sign-in, run through the real route with Auth and the database scripted: only privacy-safe fingerprints are recorded for failures, a source that has failed
// too often is cooled down before any PIN is tried, a correct PIN clears the source's failures, and the password sent to Auth is the hardened one, never the PIN.
let cooldown = 0, signInResult, recordError = null, clearError = null;
let database, attempts;
const makeDatabase = () => recordingDatabase(() => ({ data: { id: "player-1" }, error: null }), {
  rpc: (name) => {
    if (name === "pin_login_cooldown_seconds") return { data: cooldown, error: null };
    if (name === "record_failed_pin_login") return { data: null, error: recordError };
    if (name === "clear_failed_pin_logins") return { data: null, error: clearError };
    return { data: null, error: null };
  },
});
globalThis.loginFixture = { database: null, signIn: async (credentials) => { attempts.push(credentials); return signInResult; } };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@supabase/supabase-js") return { url: "data:text/javascript,export const createClient = () => ({ auth: { signInWithPassword: (credentials) => globalThis.loginFixture.signIn(credentials) } });", shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseServerKey = 'server-key-for-the-test';export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.loginFixture.database[name](...args) });", shortCircuit: true };
    if (specifier === "@/lib/player-activity") return { url: "data:text/javascript,export const recordPlayerActivity = async () => {}; export const activityDetails = () => ({});", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
process.env.PLAYER_AUTH_PEPPER = "x".repeat(40);
const { NextRequest } = await import("next/server.js");
const { POST } = await import("../src/app/api/login/route.ts");
const fail = { data: { session: null, user: null }, error: { message: "Invalid login credentials" } };
const pass = { data: { session: { access_token: "access", refresh_token: "refresh" }, user: { id: "auth-1" } }, error: null };
const login = async (pin, { result = fail, cool = 0, record = null, clear = null } = {}) => {
  database = makeDatabase(); globalThis.loginFixture.database = database; attempts = [];
  signInResult = result; cooldown = cool; recordError = record; clearError = clear;
  const response = await POST(new NextRequest("http://localhost/api/login", { method: "POST", headers: { "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify({ pin }) }));
  return { status: response.status, body: await response.json(), headers: response.headers };
};
const rpc = (name) => database.rpcCalls.filter((call) => call.name === name);

test("anything but four digits is refused before Auth is asked", async () => {
  for (const pin of ["123", "12345", "12a4", "", 1234]) assert.equal((await login(pin)).status, 400, JSON.stringify(pin));
  assert.equal(attempts.length, 0);
});

test("a wrong PIN is recorded only as fingerprints, never as the PIN or the address, and the password Auth sees is the hardened one", async () => {
  const result = await login("4821");
  assert.equal(result.status, 401);
  assert.equal(attempts.length, 1);
  assert.notEqual(attempts[0].password, "4821");
  assert.ok(!/^pickem-/.test(attempts[0].password) && attempts[0].password.length >= 32, "the PIN is stretched with the server secret, not used as the password");
  const [recorded] = rpc("record_failed_pin_login");
  assert.ok(recorded, "the failure is recorded");
  for (const value of Object.values(recorded.args)) assert.match(value, /^[0-9a-f]{64}$/, "a fingerprint, not a readable value");
  const everything = JSON.stringify([database.rpcCalls, result.body]);
  assert.ok(!everything.includes("4821") && !everything.includes("203.0.113.9"), "neither the PIN nor the address is stored or echoed");
  assert.equal(rpc("clear_failed_pin_logins").length, 0);
});

test("a source cooled down for too many failures is turned away before any PIN is tried", async () => {
  const result = await login("4821", { cool: 90 });
  assert.equal(result.status, 429);
  assert.equal(result.headers.get("retry-after"), "90");
  assert.equal(attempts.length, 0, "Auth is not asked");
  assert.equal(rpc("record_failed_pin_login").length, 0);
});

test("a correct PIN returns the session and clears the source's earlier failures, even if clearing fails", async () => {
  const ok = await login("4821", { result: pass });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { session: { access_token: "access", refresh_token: "refresh" } });
  assert.equal(rpc("clear_failed_pin_logins").length, 1);
  assert.equal(rpc("record_failed_pin_login").length, 0, "no failure is recorded for a correct PIN");
  const logged = [], realError = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    const stillOk = await login("4821", { result: pass, clear: { code: "XX000" } });
    assert.equal(stillOk.status, 200, "a bookkeeping failure never blocks a correct PIN");
  } finally { console.error = realError; }
  assert.equal(logged.length, 1, "but it is reported, not swallowed");
  assert.ok(!logged[0].includes("4821"), "without the PIN in the report");
});

test("when the failure cannot be recorded the answer is unavailable, not a false 'wrong PIN'", async () => {
  assert.equal((await login("4821", { record: { code: "XX000" } })).status, 503);
});

test("the failure that crosses the limit is answered with the cooldown at once", async () => {
  database = makeDatabase();
  let calls = 0;
  globalThis.loginFixture.database = recordingDatabase(() => ({ data: null, error: null }), { rpc: (name) => (name === "pin_login_cooldown_seconds" ? { data: ++calls === 1 ? 0 : 300, error: null } : { data: null, error: null }) });
  attempts = []; signInResult = fail;
  const response = await POST(new NextRequest("http://localhost/api/login", { method: "POST", body: JSON.stringify({ pin: "0000" }) }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "300");
});
