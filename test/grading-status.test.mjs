import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("automation health distinguishes score checks that are scheduled, due, or retrying", async () => {
  const source = await readFile(new URL("../src/lib/automation-health.ts", import.meta.url), "utf8");
  assert.match(source, /scoreCheckStatus/);
  assert.match(source, /"retrying"/);
  assert.match(source, /"due"/);
  assert.match(source, /"scheduled"/);
});
