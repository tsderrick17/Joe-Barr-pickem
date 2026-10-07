import assert from "node:assert/strict";
import test from "node:test";
import { executeAuthenticatedRequest } from "../src/lib/authenticated-request.js";

function scenario({ init = {}, responses = [new Response("ok")], session = { access_token: "old" }, refresh = { session: { access_token: "new" }, error: null } } = {}) {
  const calls = [];
  let index = 0;
  const dependencies = {
    init,
    getSession: async () => { calls.push("session"); return session; },
    refreshSession: async () => { calls.push("refresh"); return refresh; },
    send: async (token) => {
      calls.push(["send", token]);
      const response = responses[index++];
      if (response instanceof Error) throw response;
      return response;
    },
    wait: async () => { calls.push("wait"); },
    unavailable: (message) => new Error(message ?? "session unavailable"),
  };
  return { dependencies, calls };
}

test("a valid session sends once and does not refresh", async () => {
  const { dependencies, calls } = scenario();
  assert.equal((await executeAuthenticatedRequest(dependencies)).status, 200);
  assert.deepEqual(calls, ["session", ["send", "old"]]);
});

test("safe reads retry one network failure or transient status", async () => {
  for (const first of [new Error("offline"), ...[502, 503, 504].map((status) => new Response("retry", { status }))]) {
    const { dependencies, calls } = scenario({ responses: [first, new Response("ok")] });
    assert.equal((await executeAuthenticatedRequest(dependencies)).status, 200);
    assert.deepEqual(calls, ["session", ["send", "old"], "wait", ["send", "old"]]);
  }
});

test("uncertain mutations and aborted reads are never retried", async () => {
  const failure = new Error("response lost");
  for (const init of [{ method: "PUT" }, { method: "POST" }]) {
    const { dependencies, calls } = scenario({ init, responses: [failure] });
    await assert.rejects(executeAuthenticatedRequest(dependencies), /response lost/);
    assert.deepEqual(calls, ["session", ["send", "old"]]);
  }
  const aborted = scenario({ responses: [new DOMException("cancelled", "AbortError")] });
  await assert.rejects(executeAuthenticatedRequest(aborted.dependencies), { name: "AbortError" });
  assert.deepEqual(aborted.calls, ["session", ["send", "old"]]);
  const serverFailure = scenario({ init: { method: "PUT" }, responses: [new Response("busy", { status: 503 })] });
  assert.equal((await executeAuthenticatedRequest(serverFailure.dependencies)).status, 503);
  assert.deepEqual(serverFailure.calls, ["session", ["send", "old"]]);
});

test("401 refreshes once and retries with the new token", async () => {
  const { dependencies, calls } = scenario({ responses: [new Response("expired", { status: 401 }), new Response("ok")] });
  assert.equal((await executeAuthenticatedRequest(dependencies)).status, 200);
  assert.deepEqual(calls, ["session", ["send", "old"], "refresh", ["send", "new"]]);
});

test("missing or unrefreshable sessions report sign-in failure", async () => {
  const missing = scenario({ session: null });
  await assert.rejects(executeAuthenticatedRequest(missing.dependencies), /session unavailable/);
  assert.deepEqual(missing.calls, ["session"]);
  for (const refresh of [{ session: null, error: null }, { session: null, error: new Error("expired") }]) {
    const expired = scenario({ refresh, responses: [new Response("expired", { status: 401 })] });
    await assert.rejects(executeAuthenticatedRequest(expired.dependencies), /Your sign-in expired/);
    assert.deepEqual(expired.calls, ["session", ["send", "old"], "refresh"]);
  }
  const refused = scenario({ responses: [new Response("expired", { status: 401 }), new Response("still invalid", { status: 401 })] });
  await assert.rejects(executeAuthenticatedRequest(refused.dependencies), /could not be verified/);
  assert.deepEqual(refused.calls, ["session", ["send", "old"], "refresh", ["send", "new"]]);
});
