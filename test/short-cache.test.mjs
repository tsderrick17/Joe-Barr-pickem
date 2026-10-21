import assert from "node:assert/strict";
import test from "node:test";
import { createShortCache } from "../src/lib/short-cache.js";

test("a value is reused until it is older than the limit, then built again", async () => {
  let clock = 0, builds = 0;
  const read = createShortCache(60_000, async () => ++builds, () => clock);
  assert.equal(await read(), 1);
  clock = 59_999;
  assert.equal(await read(), 1, "still fresh");
  clock = 60_000;
  assert.equal(await read(), 2, "stale: built again");
  assert.equal(builds, 2);
});

test("requests that arrive while it is being built share that one build", async () => {
  let builds = 0, release = () => {};
  const read = createShortCache(1_000, () => new Promise((resolve) => { builds += 1; release = () => resolve("ready"); }));
  const first = read(), second = read(), third = read();
  release();
  assert.deepEqual(await Promise.all([first, second, third]), ["ready", "ready", "ready"]);
  assert.equal(builds, 1);
});

test("a failed build is not kept: the next request tries again", async () => {
  let attempts = 0;
  const read = createShortCache(1_000, async () => { attempts += 1; if (attempts === 1) throw new Error("down"); return "ok"; });
  await assert.rejects(read(), /down/);
  assert.equal(await read(), "ok");
  assert.equal(attempts, 2);
});
