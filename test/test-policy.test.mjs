import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

// What a test may pin. The screenshot suite (test/visual) fails on any pixel change to a state, more strictly than a
// regular expression over rule text, and without breaking on a harmless refactor. So a test never matches the text of
// the stylesheet: add or extend a screenshot state instead (docs/VIEW_STATES.md). The one allowance is the
// stylesheet budget, which measures the stylesheet with scripts/css-report.mjs rather than matching its text.
test("no test matches the text of the stylesheet", async () => {
  const files = (await readdir(new URL(".", import.meta.url))).filter((name) => name.endsWith(".test.mjs") && name !== "test-policy.test.mjs");
  const offenders = [];
  for (const name of files) {
    const source = await readFile(new URL(name, import.meta.url), "utf8");
    if (/src\/(styles\/[\w.-]+|app\/globals)\.css/.test(source) || /readStylesheet(Sync)?\b/.test(source)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `These tests read the stylesheet's text. Use a screenshot state instead (docs/VIEW_STATES.md): ${offenders.join(", ")}`);
});
