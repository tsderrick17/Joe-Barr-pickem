import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const referenceFiles = [
  "AGENTS.md",
  "README.md",
  "docs/PROJECT_REFERENCE.md",
  "docs/SOP_INDEX.md",
  "docs/DECISION_LOG.md",
];

async function repositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function relativeMarkdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().replace(/^<|>$/g, ""))
    .filter((target) => !/^(?:https?:|mailto:|#)/i.test(target))
    .map((target) => decodeURIComponent(target.split("#", 1)[0]));
}

test("the layered project reference is linked, local, and within the Codex instruction limit", async () => {
  const agentsPath = path.join(repositoryRoot, "AGENTS.md");
  const agentsStats = await stat(agentsPath);
  assert.ok(agentsStats.size < 32 * 1024, `AGENTS.md is ${agentsStats.size} bytes; keep it below 32 KiB`);

  const agents = await repositoryFile("AGENTS.md");
  for (const requiredReference of [
    "docs/PROJECT_REFERENCE.md",
    "docs/SOP_INDEX.md",
    "docs/DECISION_LOG.md",
    "docs/supabase-github-cutover.md",
  ]) {
    assert.match(agents, new RegExp(requiredReference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const relativeFile of referenceFiles) {
    const markdown = await repositoryFile(relativeFile);
    const containingDirectory = path.dirname(path.join(repositoryRoot, relativeFile));
    for (const target of relativeMarkdownLinks(markdown)) {
      await assert.doesNotReject(
        access(path.resolve(containingDirectory, target)),
        `${relativeFile} links to missing local target ${target}`,
      );
    }
  }
});

test("durable lifecycle rules remain anchored to executable implementation", async () => {
  const reference = await repositoryFile("docs/PROJECT_REFERENCE.md");
  const recapTiming = await repositoryFile("src/lib/weekly-recap-timing.js");
  const weekRollover = await repositoryFile("src/lib/week-rollover.js");
  const scheduleProvider = await repositoryFile("src/lib/full-schedule-provider.js");
  const reconciliation = await repositoryFile("src/lib/schedule-reconciliation.js");
  const playoffEligibility = await repositoryFile(
    "supabase/migrations/20260809008000_fix_full_season_playoff_eligibility_math.sql",
  );
  const migrationPolicy = await repositoryFile("docs/supabase-github-cutover.md");

  assert.match(reference, /Tuesday at 6:30 AM Eastern/);
  assert.match(recapTiming, /getUTCDate\(\), 6, 30\)\.toISOString\(\)/);

  assert.match(reference, /Wednesday at 3:00 AM Eastern/);
  assert.match(weekRollover, /getUTCDate\(\),\s*3,\s*\)\.toISOString\(\)/);
  assert.match(weekRollover, /oneDayMilliseconds/);

  assert.match(reference, /all 272 games and\s+all 18 weeks/);
  assert.match(scheduleProvider, /games\.length !== 272/);

  assert.match(reference, /omitted by the provider is reported but never deleted/);
  assert.match(reconciliation, /missingFromProvider/);

  assert.match(reference, /future pending picks are atomically changed to `void`/);
  assert.match(playoffEligibility, /set result = 'void'/);

  assert.match(reference, /new timestamped migrations/);
  assert.match(migrationPolicy, /every database change gets a timestamped migration/);
});
