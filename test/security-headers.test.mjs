import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("every response receives the enforced browser security policy", async () => {
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");

  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /default-src 'self'/);
  assert.match(config, /object-src 'none'/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /base-uri 'self'/);
  assert.match(config, /form-action 'self'/);
  assert.match(config, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(config, /supabaseSources\.websocket/);
  assert.doesNotMatch(config, /script-src[^\n]*'unsafe-eval'[^\n]*production/);
});

test("CI blocks high production advisories and documents dev-only exceptions", async () => {
  const [workflow, policy] = await Promise.all([
    readFile(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8"),
    readFile(new URL("../docs/DEPENDENCY_SECURITY.md", import.meta.url), "utf8"),
  ]);

  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
  assert.match(workflow, /npm audit --audit-level=critical/);
  // Every listed exception names an advisory and a review date that has not passed.
  const exceptions = policy.split(/\r?\n/).filter((line) => line.startsWith("| `GHSA-"));
  for (const row of exceptions) {
    const reviewBy = row.match(/\| (\d{4}-\d{2}-\d{2}) \|\s*$/)?.[1];
    assert.ok(reviewBy, `exception without a review date: ${row}`);
    assert.ok(reviewBy >= new Date().toISOString().slice(0, 10), `exception past its review date: ${row}`);
  }
});
