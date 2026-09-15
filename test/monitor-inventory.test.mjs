import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("monitoring guidance matches the specialized production monitors", async () => {
  const [monitoring, sop] = await Promise.all([
    readFile(new URL("../docs/uptime-monitoring.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/SOP_INDEX.md", import.meta.url), "utf8"),
  ]);
  assert.match(monitoring, /PickemJB line-lock workers/);
  assert.match(monitoring, /PickemJB score workers/);
  assert.match(monitoring, /PickemJB reminder workers/);
  assert.doesNotMatch(monitoring, /PickemJB critical workers/);
  assert.doesNotMatch(sop, /PickemJB critical workers/);
});
