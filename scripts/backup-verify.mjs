// Proves a weekly backup holds real data. It counts the rows in the dump's COPY blocks, counts the same tables in the disposable database the dump was
// restored into, and fails when a table came back with a different number of rows or when a table that must have rows has none.
// Usage (in the backup workflow): node scripts/backup-verify.mjs <folder with data.sql>   (psql settings come from PGHOST, PGUSER, PGPASSWORD, PGDATABASE)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Tables that must hold rows in any real backup: a dump that carries none of them is an empty shell, whatever else it says. */
export const REQUIRED_TABLES = ["public.players", "public.seasons", "public.games", "public.scoring_periods", "public.teams", "public.picks", "auth.users"];

const COPY_HEADER = /^COPY "?([a-z_][a-z0-9_]*)"?\."?([a-z_][a-z0-9_]*)"? /;

/**
 * Rows per table in a pg_dump `--use-copy` data dump: each `COPY schema.table (...) FROM stdin;` block runs to a line that is only `\.`, one row per line
 * (COPY escapes line breaks inside values, so a row is never split).
 * @param {string} sql
 * @returns {Map<string, number>} "schema.table" to row count
 */
export function copyRowCounts(sql) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  let current = null;
  for (const line of sql.split("\n")) {
    if (current === null) {
      const header = COPY_HEADER.exec(line);
      if (header) { current = `${header[1]}.${header[2]}`; counts.set(current, (counts.get(current) ?? 0)); }
    } else if (line === "\\.") current = null;
    else counts.set(current, (counts.get(current) ?? 0) + 1);
  }
  return counts;
}

/**
 * What is wrong with a restore, in plain words; empty when it is sound.
 * @param {{ expected: Map<string, number>, restored: Map<string, number>, required?: string[] }} counts
 * @returns {string[]}
 */
export function backupProblems({ expected, restored, required = REQUIRED_TABLES }) {
  const problems = [];
  for (const table of required) {
    if (!(expected.get(table) > 0)) problems.push(`${table}: the backup holds no rows`);
  }
  for (const [table, count] of expected) {
    const back = restored.get(table);
    if (back !== count) problems.push(`${table}: the backup has ${count} rows, the restored copy has ${back ?? "none"}`);
  }
  return problems;
}

/** @param {string} table "schema.table", already checked to be plain names */
function restoredCount(table) {
  const [schema, name] = table.split(".");
  const out = execFileSync("psql", ["--tuples-only", "--no-align", "--command", `select count(*) from "${schema}"."${name}";`], { encoding: "utf8" });
  return Number(out.trim());
}

function main(folder) {
  const expected = new Map();
  for (const [table, count] of copyRowCounts(readFileSync(join(folder, "data.sql"), "utf8"))) expected.set(table, count);
  const restored = new Map([...expected.keys()].map((table) => [table, restoredCount(table)]));
  for (const [table, count] of [...expected].sort(([a], [b]) => a.localeCompare(b))) console.log(`${table.padEnd(44)} backup ${String(count).padStart(8)}   restored ${String(restored.get(table)).padStart(8)}`);
  const problems = backupProblems({ expected, restored });
  if (problems.length) {
    for (const problem of problems) console.error(`BACKUP PROBLEM: ${problem}`);
    process.exit(1);
  }
  console.log(`Backup check passed: ${expected.size} tables restored with matching row counts.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2] ?? ".");
