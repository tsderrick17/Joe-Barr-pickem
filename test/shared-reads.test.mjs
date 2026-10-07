import assert from "node:assert/strict";
import test from "node:test";
import { createSharedReadCache } from "../src/lib/shared-read-cache.js";

function setup() {
  const timers = [];
  const cache = createSharedReadCache({
    origin: () => "https://pool.example",
    schedule: (callback, delay) => { timers.push({ callback, delay }); },
  });
  return { cache, timers };
}

test("simultaneous plain reads share a single response, with independent bodies", async () => {
  const { cache } = setup();
  let resolve;
  let calls = 0;
  const read = () => { calls += 1; return new Promise((done) => { resolve = done; }); };
  const first = cache.run("/api/board?week=1", {}, read);
  const second = cache.run("/api/board?week=1", {}, read);
  assert.equal(calls, 1);
  resolve(Response.json({ week: 1 }));
  const [one, two] = await Promise.all([first, second]);
  assert.notEqual(one, two);
  assert.deepEqual(await one.json(), { week: 1 });
  assert.deepEqual(await two.json(), { week: 1 });
  await cache.run("/api/board?week=1", {}, async () => { calls += 1; return Response.json({ week: 1 }); });
  assert.equal(calls, 2, "non-profile reads are forgotten after completion");
});

test("only successful profile reads are kept briefly; no-store and failed reads are not kept", async () => {
  const { cache, timers } = setup();
  let calls = 0;
  const read = async () => { calls += 1; return Response.json({ name: "A" }); };
  await cache.run("/api/profile", {}, read);
  await cache.run("/api/profile", {}, read);
  assert.equal(calls, 1);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 15_000);
  timers[0].callback();
  await cache.run("/api/profile", {}, read);
  assert.equal(calls, 2);
  cache.clear();
  await cache.run("/api/profile", { cache: "no-store" }, read);
  await cache.run("/api/profile", { cache: "no-store" }, read);
  assert.equal(calls, 4);
  cache.clear();
  await cache.run("/api/profile", {}, async () => new Response("unavailable", { status: 503 }));
  await cache.run("/api/profile", {}, read);
  assert.equal(calls, 5, "a failed profile read cannot be retained");
});

test("a successful save clears that path, while a failed save cannot clear it", async () => {
  const { cache } = setup();
  let reads = 0;
  const read = async () => { reads += 1; return Response.json({ value: reads }); };
  await cache.run("/api/profile", {}, read);
  await cache.run("/api/profile", { method: "PUT" }, async () => new Response("failed", { status: 500 }));
  await cache.run("/api/profile", {}, read);
  assert.equal(reads, 1);
  await cache.run("/api/profile", { method: "PUT" }, async () => Response.json({ saved: true }));
  await cache.run("/api/profile", {}, read);
  assert.equal(reads, 2);
});

test("identity change drops old reads, including an in-flight read that settles later", async () => {
  const { cache } = setup();
  let resolveOld;
  const old = cache.run("/api/profile", {}, () => new Promise((done) => { resolveOld = done; }));
  cache.clear();
  let newCalls = 0;
  const current = () => { newCalls += 1; return Promise.resolve(Response.json({ person: "new" })); };
  assert.deepEqual(await (await cache.run("/api/profile", {}, current)).json(), { person: "new" });
  resolveOld(Response.json({ person: "old" }));
  assert.deepEqual(await (await old).json(), { person: "old" });
  assert.deepEqual(await (await cache.run("/api/profile", {}, current)).json(), { person: "new" });
  assert.equal(newCalls, 1, "the old request must not evict the new identity's cached read");
});

test("cancellable reads and mutations are never shared", async () => {
  const { cache } = setup();
  let calls = 0;
  const operation = async () => { calls += 1; return Response.json({ calls }); };
  const signal = new AbortController().signal;
  await cache.run("/api/board", { signal }, operation);
  await cache.run("/api/board", { signal }, operation);
  await cache.run("/api/board", { method: "POST" }, operation);
  await cache.run("/api/board", { method: "POST" }, operation);
  assert.equal(calls, 4);
});

test("rejected reads are forgotten and cannot evict a newer successful read", async () => {
  const { cache, timers } = setup();
  await assert.rejects(cache.run("/api/profile", {}, async () => { throw new Error("offline"); }), /offline/);
  let calls = 0;
  const read = () => { calls += 1; return Promise.resolve(Response.json({ calls })); };
  await cache.run("/api/profile", {}, read);
  assert.equal(calls, 1);
  cache.clear();
  await cache.run("/api/profile", {}, read);
  timers[0].callback();
  await cache.run("/api/profile", {}, read);
  assert.equal(calls, 2, "the older expiry timer cannot evict the current identity's read");
});
