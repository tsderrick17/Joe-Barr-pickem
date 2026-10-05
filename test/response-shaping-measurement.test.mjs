import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("the response-shaping baseline is reproducible on fictional data", () => {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL("../scripts/measure-response-shaping.mjs", import.meta.url)), "--json"], {
    encoding: "utf8", timeout: 30_000,
  });
  const report = JSON.parse(output);
  assert.equal(report.kind, "fictional-response-shaping-only");
  assert.deepEqual(report.results.map((item) => item.scenario), ["early_regular", "late_regular", "playoff_round"]);
  assert.deepEqual(report.results.map((item) => item.inputRows.players), [11, 11, 11]);
  assert.deepEqual(report.results.map((item) => item.standingsShape.outputRows), [11, 11, 11]);
  assert.deepEqual(report.results.map((item) => item.slateShape.outputRows), [16, 16, 6]);
  for (const item of report.results) {
    assert.ok(item.standingsShape.shapedBytes > 0);
    assert.ok(item.slateShape.shapedBytes > 0);
    assert.ok(item.standingsShape.medianMs >= 0);
    assert.ok(item.slateShape.medianMs >= 0);
  }
});
