import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";

const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, delay, ...args) => {
  const timer = originalSetTimeout(callback, delay, ...args);
  if (delay === 15_000) timer.unref();
  return timer;
};
after(() => { globalThis.setTimeout = originalSetTimeout; });

const state = {
  session: null,
  sessionReads: 0,
  onAuthStateChange: null,
};
globalThis.authWiringState = state;
globalThis.window = {
  location: { origin: "https://pool.example" },
  setTimeout(callback, delay) {
    // Profile-cache expiry is exercised in the cache unit tests. Do not hold
    // this process open for its 15-second production TTL.
    return delay === 15_000 ? 0 : setTimeout(callback, 0);
  },
  clearTimeout,
};
globalThis.authWiringSupabase = {
  auth: {
    async getSession() {
      state.sessionReads += 1;
      return { data: { session: state.session }, error: null };
    },
    async refreshSession() { return { data: { session: state.session }, error: null }; },
    onAuthStateChange(callback) { state.onAuthStateChange = callback; },
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase") return {
      url: "data:text/javascript,export const supabase = globalThis.authWiringSupabase;",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

const { fetchWithSession } = await import("../src/lib/auth-session.ts");
const freshSession = (token) => ({
  access_token: token,
  expires_at: Math.floor(Date.now() / 1000) + 600,
});

test("the browser path shares concurrent reads and gives each caller its own response body", async () => {
  state.onAuthStateChange("SIGNED_IN");
  state.session = freshSession("player-one");
  state.sessionReads = 0;
  const originalFetch = globalThis.fetch;
  let releaseFetch;
  const sent = [];
  globalThis.fetch = async (_input, init) => {
    sent.push(init.headers.get("Authorization"));
    return new Promise((resolve) => { releaseFetch = resolve; });
  };
  try {
    const first = fetchWithSession("/api/board?week=1");
    const second = fetchWithSession("/api/board?week=1");
    await new Promise(setImmediate);
    assert.equal(state.sessionReads, 1);
    assert.deepEqual(sent, ["Bearer player-one"]);
    releaseFetch(Response.json({ week: 1 }));
    const [one, two] = await Promise.all([first, second]);
    assert.notEqual(one, two);
    assert.deepEqual(await one.json(), { week: 1 });
    assert.deepEqual(await two.json(), { week: 1 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sign-out and a different sign-in clear the retained profile and use the new token", async () => {
  state.onAuthStateChange("SIGNED_OUT");
  state.session = freshSession("player-one");
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (_input, init) => {
    const token = init.headers.get("Authorization");
    sent.push(token);
    return Response.json({ token });
  };
  try {
    await fetchWithSession("/api/profile");
    await fetchWithSession("/api/profile");
    assert.deepEqual(sent, ["Bearer player-one"]);

    state.session = null;
    state.onAuthStateChange("SIGNED_OUT");
    await assert.rejects(fetchWithSession("/api/profile"), /sign-in session is unavailable/i);

    state.session = freshSession("player-two");
    state.onAuthStateChange("SIGNED_IN");
    const response = await fetchWithSession("/api/profile");
    assert.deepEqual(await response.json(), { token: "Bearer player-two" });
    assert.deepEqual(sent, ["Bearer player-one", "Bearer player-two"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a successful profile save invalidates its cached read through the browser path", async () => {
  state.onAuthStateChange("SIGNED_IN");
  state.session = freshSession("player-one");
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (_input, init) => {
    sent.push(init.method ?? "GET");
    return Response.json({ calls: sent.length });
  };
  try {
    await fetchWithSession("/api/profile");
    await fetchWithSession("/api/profile", { method: "PUT" });
    const response = await fetchWithSession("/api/profile");
    assert.deepEqual(await response.json(), { calls: 3 });
    assert.deepEqual(sent, ["GET", "PUT", "GET"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an external URL cannot receive the player's bearer token", async () => {
  state.onAuthStateChange("SIGNED_IN");
  state.session = freshSession("player-one");
  state.sessionReads = 0;
  const originalFetch = globalThis.fetch;
  let sent = false;
  globalThis.fetch = async () => { sent = true; return Response.json({}); };
  try {
    for (const input of [
      "https://other.example/api/profile",
      "//other.example/api/profile",
      "https://pool.example.other.example/api/profile",
      new URL("https://other.example/api/profile"),
      new Request("https://other.example/api/profile"),
    ]) {
      await assert.rejects(fetchWithSession(input), /must target this application/);
    }
    assert.equal(state.sessionReads, 0);
    assert.equal(sent, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
