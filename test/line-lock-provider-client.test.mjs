import assert from "node:assert/strict";
import test from "node:test";
import { fetchLineLockProviderEvents } from "../src/lib/line-lock-provider-client.js";

const events = [{ id: "event-1", bookmakers: [] }];

test("line-lock provider fetch preserves quota headers and passes a timeout signal", async () => {
  let requestUrl;
  let requestOptions;
  const result = await fetchLineLockProviderEvents("test-key", async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response(JSON.stringify(events), {
      headers: {
        "x-requests-remaining": "42",
        "x-requests-used": "8",
        "x-requests-last": "1",
      },
    });
  });
  assert.equal(new URL(requestUrl).searchParams.get("bookmakers"), "draftkings");
  assert.equal(new URL(requestUrl).searchParams.get("markets"), "spreads");
  assert.equal(requestOptions.cache, "no-store");
  assert.ok(requestOptions.signal instanceof AbortSignal);
  assert.deepEqual(result, {
    events,
    providerAvailable: true,
    requestsRemaining: "42",
    requestsUsed: "8",
    requestsLast: "1",
    warning: null,
  });
});

test("HTTP failure preserves provider quota headers for fallback reporting", async () => {
  const result = await fetchLineLockProviderEvents("test-key", async () =>
    new Response("busy", {
      status: 503,
      headers: { "x-requests-remaining": "3", "x-requests-last": "1" },
    }));
  assert.equal(result.providerAvailable, false);
  assert.deepEqual(result.events, []);
  assert.equal(result.requestsRemaining, "3");
  assert.equal(result.requestsLast, "1");
  assert.match(result.warning, /unavailable/);
});

test("malformed payload and network failure remain fallback-eligible", async () => {
  const malformed = await fetchLineLockProviderEvents("test-key", async () =>
    new Response("{}"));
  assert.equal(malformed.providerAvailable, false);
  assert.match(malformed.warning, /unexpected response/);

  const offline = await fetchLineLockProviderEvents("test-key", async () => {
    throw new Error("offline");
  });
  assert.equal(offline.providerAvailable, false);
  assert.match(offline.warning, /could not be reached/);
});

test("an expired lease prevents the provider call", async () => {
  const controller = new AbortController();
  const reason = new Error("lease expired");
  controller.abort(reason);
  let called = false;
  await assert.rejects(
    fetchLineLockProviderEvents("test-key", async () => {
      called = true;
      return new Response("[]");
    }, controller.signal),
    reason,
  );
  assert.equal(called, false);
});

test("lease cancellation during fetch is not treated as provider fallback", async () => {
  const controller = new AbortController();
  const reason = new Error("lease expired");
  const pending = fetchLineLockProviderEvents("test-key", async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason));
    }), controller.signal);
  controller.abort(reason);
  await assert.rejects(pending, reason);
});
