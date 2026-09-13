import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("automation lease claims use bounded retries while preserving the overlap guard", async () => {
  const source = await readFile(new URL("../src/lib/automation-execution-lease.ts", import.meta.url), "utf8");
  assert.match(source, /LEASE_CLAIM_RETRY_DELAYS_MS = \[150, 450\]/);
  assert.match(source, /claimAutomationLease\(job\)/);
  assert.match(source, /if \(!token\) \{/);
  assert.match(source, /release_automation_execution_lease/);
});
