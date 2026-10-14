import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const store = new Map();
globalThis.window = { localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } };
const { rememberBowlCard, startBowlPrefetch, takeBowlPrefetch } = await import("../src/lib/bowl-prefetch.ts");

test("the Bowl Card's read starts early only on a device that showed the card last time, and is taken once", async () => {
  let reads = 0;
  const read = () => { reads += 1; return Promise.resolve({ ok: true, reads, clone() { return { ok: true, reads, copy: true }; } }); };

  startBowlPrefetch(read);
  assert.equal(reads, 0, "a first visit starts nothing early");
  assert.equal(takeBowlPrefetch(), null);

  rememberBowlCard(false);
  startBowlPrefetch(read);
  assert.equal(reads, 0, "a device that hid the card starts nothing early");

  rememberBowlCard(true);
  startBowlPrefetch(read);
  startBowlPrefetch(read);
  assert.equal(reads, 1, "one early read, however many times the page asks");
  const taken = takeBowlPrefetch();
  assert.equal((await taken).reads, 1, "the card takes that same response");
  assert.equal((await takeBowlPrefetch()).reads, 1, "a second ask in the same moment (a remount) gets a copy of it");
  const realNow = Date.now;
  Date.now = () => realNow() + 2_000;
  try { assert.equal(takeBowlPrefetch(), null, "a later ask (a refresh) reads fresh"); } finally { Date.now = realNow; }
});

test("a failed early read never throws, and a stale one is not reused", async () => {
  rememberBowlCard(true);
  startBowlPrefetch(() => Promise.reject(new Error("offline")));
  await assert.rejects(takeBowlPrefetch(), /offline/, "the card sees the failure and falls back like any failed read");
  takeBowlPrefetch()?.catch(() => undefined);
  const realNow = Date.now;
  Date.now = () => realNow() + 2_000;
  try { assert.equal(takeBowlPrefetch(), null); } finally { Date.now = realNow; }
  startBowlPrefetch(() => Promise.resolve({ ok: true, clone() { return this; } }));
  Date.now = () => realNow() + 20_000;
  try { assert.equal(takeBowlPrefetch(), null, "an early read older than 15 seconds is discarded"); } finally { Date.now = realNow; }
});
