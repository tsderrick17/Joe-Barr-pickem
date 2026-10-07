import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const baselineBytes = {
  early_regular: { standingsShape: 4162, slateShape: 8372 },
  late_regular: { standingsShape: 4406, slateShape: 8688 },
  playoff_round: { standingsShape: 10781, slateShape: 3563 },
};
const MAX_FRAGMENT_GROWTH = 1.25;

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
    const baseline = baselineBytes[item.scenario];
    for (const shape of ["standingsShape", "slateShape"]) {
      assert.ok(
        item[shape].shapedBytes <= Math.ceil(baseline[shape] * MAX_FRAGMENT_GROWTH),
        `${item.scenario} ${shape} exceeded its fictional JSON-fragment size budget`,
      );
    }
  }
});
