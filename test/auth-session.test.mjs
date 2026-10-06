import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

globalThis.authSessionTestState = {
  getSession: async () => ({ data: { session: null }, error: null }),
  refreshSession: async () => ({ data: { session: null }, error: null }),
  authStateListener: null,
  cacheClears: 0,
};
globalThis.sessionTestWindow = {
  setTimeout(callback) { return setTimeout(callback, 0); },
  clearTimeout,
};
globalThis.window = globalThis.sessionTestWindow;
globalThis.sessionTestSupabase = {
  auth: {
    getSession: (...args) => globalThis.authSessionTestState.getSession(...args),
    refreshSession: (...args) => globalThis.authSessionTestState.refreshSession(...args),
    onAuthStateChange(callback) { globalThis.authSessionTestState.authStateListener = callback; },
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase") return {
      url: "data:text/javascript,export const supabase = globalThis.sessionTestSupabase;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/authenticated-request") return {
      url: "data:text/javascript,export async function executeAuthenticatedRequest(){ return new Response('ok'); }",
      shortCircuit: true,
    };
    if (specifier === "@/lib/shared-read-cache") return {
      url: "data:text/javascript,export function createSharedReadCache(){ return { run: (_input, _init, read) => read(), clear: () => { globalThis.authSessionTestState.cacheClears++; } }; }",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

const { getFreshSession } = await import("../src/lib/auth-session.ts");

test("parallel session reads share one in-flight hydration", async () => {
  let resolveRead;
  let calls = 0;
  const session = { access_token: "hydrated-session", expires_at: Math.floor(Date.now() / 1000) + 600 };
  globalThis.authSessionTestState.getSession = () => {
    calls++;
    return new Promise((resolve) => { resolveRead = resolve; });
  };

  const first = getFreshSession();
  const second = getFreshSession();
  assert.equal(calls, 1);
  resolveRead({ data: { session }, error: null });
  assert.equal(await first, session);
  assert.equal(await second, session);
});

test("session hydration retries empty reads within its bounded window", async () => {
  let calls = 0;
  const session = { access_token: "restored-session", expires_at: Math.floor(Date.now() / 1000) + 600 };
  globalThis.authSessionTestState.getSession = async () => {
    calls++;
    return { data: { session: calls < 3 ? null : session }, error: null };
  };

  assert.equal(await getFreshSession(), session);
  assert.equal(calls, 3);
});

test("an expiring session is refreshed before it is returned", async () => {
  const stale = { access_token: "expiring-session", expires_at: Math.floor(Date.now() / 1000) + 30 };
  const refreshed = { access_token: "refreshed-session", expires_at: Math.floor(Date.now() / 1000) + 600 };
  let refreshCalls = 0;
  globalThis.authSessionTestState.getSession = async () => ({ data: { session: stale }, error: null });
  globalThis.authSessionTestState.refreshSession = async () => {
    refreshCalls++;
    return { data: { session: refreshed }, error: null };
  };

  assert.equal(await getFreshSession(), refreshed);
  assert.equal(refreshCalls, 1);
});

test("auth identity changes clear browser shared reads", () => {
  const before = globalThis.authSessionTestState.cacheClears;
  globalThis.authSessionTestState.authStateListener("SIGNED_IN", { access_token: "another-player" });
  assert.equal(globalThis.authSessionTestState.cacheClears, before + 1);
});
