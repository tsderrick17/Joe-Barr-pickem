import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("migrations use pg_cron functions instead of mutating its protected catalog", async () => {
  const directory = path.join(root, "supabase", "migrations");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql"));
  const migrations = await Promise.all(files.map(async (file) => ({
    file,
    sql: await readFile(path.join(directory, file), "utf8"),
  })));

  for (const migration of migrations) {
    assert.doesNotMatch(
      migration.sql,
      /\b(?:delete\s+from|insert\s+into|update)\s+cron\.job\b/i,
      `${migration.file} must use cron.schedule/cron.unschedule rather than writing cron.job`,
    );
  }
});
