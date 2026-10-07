import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

// The browser session helper, run for real against a fake Supabase client and a fake fetch.
let session = null;
let refreshResult = { data: { session: null }, error: null };
let getSessionCalls = 0;
let refreshCalls = 0;
globalThis.sessionFixtureAuth = {
  async getSession() { getSessionCalls += 1; return { data: { session } }; },
  async refreshSession() { refreshCalls += 1; return refreshResult; },
  onAuthStateChange(callback) { globalThis.sessionFixtureAuthChanged = callback; },
};
globalThis.window = { location: { origin: "http://localhost" }, setTimeout: (callback) => { callback(); return 0; }, clearTimeout() {} };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase") return { url: "data:text/javascript,export const supabase = { auth: globalThis.sessionFixtureAuth };", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const sent = [];
let serverStatus = 200;
globalThis.fetch = async (input, init) => {
  sent.push({ url: String(input), token: new Headers(init.headers).get("Authorization"), method: init.method ?? "GET" });
  return new Response(JSON.stringify({ ok: serverStatus === 200 }), { status: serverStatus });
};

const { getFreshSession, fetchWithSession, SessionUnavailableError } = await import("../src/lib/auth-session.ts");

const inSeconds = (seconds) => Math.floor(Date.now() / 1000) + seconds;
const sessionFor = (name, expiresInSeconds = 3600) => ({ access_token: `token-${name}`, expires_at: inSeconds(expiresInSeconds), user: { id: name } });
function reset() {
  session = null;
  refreshResult = { data: { session: null }, error: null };
  getSessionCalls = 0;
  refreshCalls = 0;
  sent.length = 0;
  serverStatus = 200;
  globalThis.sessionFixtureAuthChanged?.();
}

test("a session with plenty of life is used as it is, with no refresh", async () => {
  reset();
  session = sessionFor("a");
  assert.equal((await getFreshSession()).access_token, "token-a");
  assert.equal(refreshCalls, 0);
});

test("a session about to expire is refreshed first, and a failed refresh means signed out", async () => {
  reset();
  session = sessionFor("a", 20);
  refreshResult = { data: { session: sessionFor("a-renewed") }, error: null };
  assert.equal((await getFreshSession()).access_token, "token-a-renewed");
  assert.equal(refreshCalls, 1);
  refreshResult = { data: { session: null }, error: { message: "refresh token revoked" } };
  assert.equal(await getFreshSession(), null);
});

test("an empty local session is re-read through the hydration window before it counts as signed out", async () => {
  reset();
  assert.equal(await getFreshSession(), null);
  assert.equal(getSessionCalls, 8);
});

test("two parts of a page asking for the session at once share one read", async () => {
  reset();
  session = sessionFor("a");
  const [first, second] = await Promise.all([getFreshSession(), getFreshSession()]);
  assert.equal(first.access_token, second.access_token);
  assert.equal(getSessionCalls, 1);
});

test("signed out: the request is never sent and the failure is the sign-in one", async () => {
  reset();
  await assert.rejects(() => fetchWithSession("/api/home"), (error) => error instanceof SessionUnavailableError);
  assert.equal(sent.length, 0);
});

test("a read carries the current token; an expired token is refreshed once and retried with the new one", async () => {
  reset();
  session = sessionFor("a");
  refreshResult = { data: { session: sessionFor("a-renewed") }, error: null };
  const statuses = [401, 200];
  globalThis.fetch = async (input, init) => {
    sent.push({ url: String(input), token: new Headers(init.headers).get("Authorization"), method: init.method ?? "GET" });
    return new Response("{}", { status: statuses.shift() ?? 200 });
  };
  const response = await fetchWithSession("/api/board");
  assert.equal(response.status, 200);
  assert.deepEqual(sent.map((entry) => entry.token), ["Bearer token-a", "Bearer token-a-renewed"]);
  assert.equal(refreshCalls, 1);
});

test("an outage is reported as an outage, and an uncertain save is sent once, never retried", async () => {
  reset();
  session = sessionFor("a");
  globalThis.fetch = async (input, init) => { sent.push({ url: String(input), token: new Headers(init.headers).get("Authorization"), method: init.method ?? "GET" }); throw new TypeError("network down"); };
  await assert.rejects(() => fetchWithSession("/api/picks", { method: "POST", body: "{}" }));
  assert.equal(sent.filter((entry) => entry.method === "POST").length, 1);
});

test("switching players clears what the last one read: the next profile read goes to the server with the new token", async () => {
  reset();
  globalThis.fetch = async (input, init) => {
    sent.push({ url: String(input), token: new Headers(init.headers).get("Authorization"), method: init.method ?? "GET" });
    return new Response(JSON.stringify({ firstName: "x" }), { status: 200 });
  };
  session = sessionFor("player-a");
  await fetchWithSession("/api/profile");
  await fetchWithSession("/api/profile");
  assert.equal(sent.length, 1, "the profile is kept for a few seconds for the same player");
  // Sign out, sign in as someone else.
  session = sessionFor("player-b");
  globalThis.sessionFixtureAuthChanged();
  await fetchWithSession("/api/profile");
  assert.deepEqual(sent.map((entry) => entry.token), ["Bearer token-player-a", "Bearer token-player-b"]);
});
