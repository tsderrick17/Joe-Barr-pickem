import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(target);
    return entry.isFile() && entry.name.endsWith(".md") ? [target] : [];
  }));
  return nested.flat();
}

test("repository documentation has no broken relative file links", async () => {
  const files = [
    path.join(root, "README.md"),
    path.join(root, "AGENTS.md"),
    ...await markdownFiles(path.join(root, "docs")),
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const links = [...source.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
    for (const link of links) {
      if (/^(?:https?:|mailto:|#)/.test(link)) continue;
      const target = decodeURIComponent(link.split("#", 1)[0]);
      await assert.doesNotReject(
        access(path.resolve(path.dirname(file), target)),
        `${path.relative(root, file)} links to missing ${target}`,
      );
    }
  }
});

test("operator-facing documentation agrees on recap timing and monitor contracts", async () => {
  const [agents, reference, monitoring] = await Promise.all([
    readFile(path.join(root, "AGENTS.md"), "utf8"),
    readFile(path.join(root, "docs", "PROJECT_REFERENCE.md"), "utf8"),
    readFile(path.join(root, "docs", "uptime-monitoring.md"), "utf8"),
  ]);

  assert.match(agents, /Tuesday at 6:30 AM Eastern/);
  assert.match(reference, /Tuesday at 6:30 AM Eastern/);
  assert.doesNotMatch(agents, /Tuesday at 8:00 AM Eastern/);
  for (const route of ["/api/health", "/api/health/automation", "/api/health/workers", "/api/health/backup"]) {
    assert.ok(monitoring.includes(route), `monitoring guide is missing ${route}`);
  }
});

test("current operating docs follow the latest score schedule and Bowl provider", async () => {
  const [reference, operations, schedule, bowlSync] = await Promise.all([
    readFile(path.join(root, "docs", "PROJECT_REFERENCE.md"), "utf8"),
    readFile(path.join(root, "docs", "OPERATIONS.md"), "utf8"),
    readFile(path.join(root, "supabase", "migrations", "20261001010000_watchdog_every_ten_minutes.sql"), "utf8"),
    readFile(path.join(root, "src", "lib", "sync-bowl-pool.ts"), "utf8"),
  ]);

  assert.match(schedule, /refresh-final-nfl-scores-every-ten-minutes/);
  assert.match(reference, /NFL score worker wakes every ten minutes/);
  assert.match(operations, /NFL score worker and watchdog wake every ten minutes/);
  assert.match(bowlSync, /site\.api\.espn\.com/);
  assert.match(reference, /ESPN is the default NCAA Bowl Pool/);
  assert.doesNotMatch(reference, /CollegeFootballData/);
  assert.doesNotMatch(operations, /full 272-game schedule/);
});
