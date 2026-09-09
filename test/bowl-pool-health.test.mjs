import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Bowl monitoring is strict only after the first kickoff", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/lib/bowl-pool-health.ts"), "utf8");
  assert.match(source, /new Date\(\) < new Date\(season\.first_kickoff_at\)/);
  assert.match(source, /healthy: true/);
});
