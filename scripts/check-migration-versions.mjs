import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const migrationsDirectory = resolve("supabase/migrations");
const migrationFiles = await readdir(migrationsDirectory);
const versions = new Map();

for (const fileName of migrationFiles) {
  const match = fileName.match(/^(\d{14})_.+\.sql$/);
  if (!match) continue;

  const version = match[1];
  const files = versions.get(version) ?? [];
  files.push(fileName);
  versions.set(version, files);
}

const duplicates = [...versions.entries()].filter(([, files]) => files.length > 1);

if (duplicates.length) {
  const details = duplicates
    .map(([version, files]) => `  ${version}: ${files.join(", ")}`)
    .join("\n");
  throw new Error(`Duplicate Supabase migration versions found:\n${details}`);
}

console.log(`Migration version check passed (${versions.size} unique versions).`);
