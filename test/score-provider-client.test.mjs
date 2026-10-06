import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchScoreProviderEvents,
  ScoreProviderClientError,
} from "../src/lib/score-provider-client.ts";

const headers = new Headers({
  "x-requests-remaining": "304",
  "x-requests-used": "2",
  "x-requests-last": "1",
});

test("requests the NFL score feed without caching and returns validated events and credit headers", async () => {
  let requestUrl;
  let requestOptions;
  const events = [{ id: "event-1", completed: true, scores: [] }];
  const result = await fetchScoreProviderEvents("test-key", async (url, options) => {
    requestUrl = new URL(url);
    requestOptions = options;
    return new Response(JSON.stringify(events), { status: 200, headers });
  });

  assert.equal(requestUrl.origin, "https://api.the-odds-api.com");
  assert.equal(requestUrl.pathname, "/v4/sports/americanfootball_nfl/scores/");
  assert.equal(requestUrl.searchParams.get("apiKey"), "test-key");
  assert.equal(requestUrl.searchParams.get("daysFrom"), "3");
  assert.equal(requestOptions.cache, "no-store");
  assert.ok(requestOptions.signal instanceof AbortSignal);
  assert.deepEqual(result.events, events);
  assert.deepEqual(
    [result.requestsRemaining, result.requestsUsed, result.requestsLast],
    ["304", "2", "1"],
  );
});

test("preserves provider credit headers when the provider returns an HTTP error", async () => {
  await assert.rejects(
    fetchScoreProviderEvents("test-key", async () =>
      new Response("unavailable", { status: 503, headers }),
    ),
    (error) => {
      assert.ok(error instanceof ScoreProviderClientError);
      assert.equal(error.message, "The NFL score feed could not be reached right now.");
      assert.deepEqual(
        [error.requestsRemaining, error.requestsUsed, error.requestsLast],
        ["304", "2", "1"],
      );
      return true;
    },
  );
});

test("rejects malformed provider payloads while retaining response usage metadata", async () => {
  await assert.rejects(
    fetchScoreProviderEvents("test-key", async () =>
      new Response(JSON.stringify({ events: [] }), { status: 200, headers }),
    ),
    (error) => {
      assert.ok(error instanceof ScoreProviderClientError);
      assert.equal(error.message, "The NFL score feed returned an invalid response.");
      assert.deepEqual(
        [error.requestsRemaining, error.requestsUsed, error.requestsLast],
        ["304", "2", "1"],
      );
      return true;
    },
  );
});

test("normalizes invalid JSON to the established invalid-response error", async () => {
  await assert.rejects(
    fetchScoreProviderEvents("test-key", async () =>
      new Response("not-json", { status: 200, headers }),
    ),
    /The NFL score feed returned an invalid response\./,
  );
});
