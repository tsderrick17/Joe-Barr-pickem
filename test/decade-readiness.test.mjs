import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a weekly keepalive re-enables every scheduled workflow so GitHub's 60-day idle rule never stops backups", async () => {
  const keepalive = await read(".github/workflows/scheduled-workflow-keepalive.yml");
  assert.match(keepalive, /schedule:\s*\n\s*- cron: "41 12 \* \* 2"/);
  assert.match(keepalive, /permissions:\s*\n\s*actions: write/);
  assert.match(keepalive, /gh api --method PUT "repos\/\$\{REPO\}\/actions\/workflows\/\$\{workflow\}\/enable"/);
  // It keeps itself alive along with every other scheduled workflow.
  for (const workflow of ["scheduled-workflow-keepalive.yml", "database-backup.yml", "weekly-production-smoke.yml", "isolated-integration.yml", "monthly-upgrade-rehearsal.yml"]) {
    assert.ok(keepalive.includes(workflow), `${workflow} is kept enabled`);
  }
  assert.doesNotMatch(keepalive, /contents: write|git commit|git push/, "it never commits");
});

test("every scheduled workflow is covered by the keepalive", async () => {
  const keepalive = await read(".github/workflows/scheduled-workflow-keepalive.yml");
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(new URL("../.github/workflows/", import.meta.url));
  for (const file of files.filter((name) => name.endsWith(".yml"))) {
    const text = await read(`.github/workflows/${file}`);
    if (/\n\s*schedule:\s*\n\s*- cron:/.test(text)) assert.ok(keepalive.includes(file), `${file} has a schedule but is not kept alive`);
  }
});

test("an expired or missing GitHub token never reports a false backup outage", async () => {
  const route = await read("src/app/api/health/backup/route.ts");
  assert.match(route, /let response = await read\(Boolean\(token\)\);/);
  assert.match(route, /if \(token && \(response\.status === 401 \|\| response\.status === 403\)\) response = await read\(false\);/);
  assert.match(route, /\.\.\.\(withToken && token \? \{ Authorization: `Bearer \$\{token\}` \} : \{\}\)/);
  assert.doesNotMatch(route, /if \(!token\) throw new Error/);
});

test("no season year is hardcoded in the Bowl Pool", async () => {
  const page = await read("src/app/bowl-pool/page.tsx");
  const schedule = await read("src/app/api/admin/bowl-pool/schedule/route.ts");
  assert.doesNotMatch(page, />2026-27 Bowl Pool</);
  assert.match(page, /\{bowlSeasonLabel\(currentSeasonYear\(\)\)\} Bowl Pool/);
  assert.match(schedule, /searchParams\.get\("seasonYear"\) \|\| currentSeasonYear\(\)/);
  // The label is computed: 2026 -> "2026-27", 2099 -> "2099-00".
  const label = (year) => `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
  assert.equal(label(2026), "2026-27");
  assert.equal(label(2099), "2099-00");
  assert.match(page, /return `\$\{seasonYear\}-\$\{String\(\(seasonYear \+ 1\) % 100\)\.padStart\(2, "0"\)\}`;/);
});
