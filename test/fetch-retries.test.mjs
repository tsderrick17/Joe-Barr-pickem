import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithRetries, unreachableReason } from "../src/lib/fetch-retries.js";

const noWait = () => Promise.resolve();

test("a dropped connection is tried again, and the first answer is taken", async () => {
  let calls = 0;
  const request = async () => { calls += 1; if (calls < 3) throw new TypeError("fetch failed"); return new Response("[]", { status: 200 }); };
  const response = await fetchWithRetries("https://example.invalid/", {}, { request, wait: noWait });
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test("an answer of any kind, even a refusal, is not tried again", async () => {
  let calls = 0;
  const request = async () => { calls += 1; return new Response("{}", { status: 401 }); };
  const response = await fetchWithRetries("https://example.invalid/", {}, { request, wait: noWait });
  assert.equal(response.status, 401);
  assert.equal(calls, 1);
});

test("after three tries without an answer it gives up with the last error, waiting between tries", async () => {
  const waited = [];
  const request = async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }); };
  await assert.rejects(fetchWithRetries("https://example.invalid/", {}, { request, wait: async (ms) => { waited.push(ms); } }), (error) => {
    assert.equal(unreachableReason(error), "the connection failed (ECONNRESET)");
    return true;
  });
  assert.deepEqual(waited, [2_000, 5_000]);
});

test("a timeout says it timed out", () => {
  assert.equal(unreachableReason(new DOMException("The operation was aborted due to timeout", "TimeoutError")), "it timed out after 10 seconds");
  assert.equal(unreachableReason("odd"), "the connection failed");
});
