// The dependency audit gate: `npm audit` at a severity, less only the advisories listed as reviewed exceptions in
// docs/DEPENDENCY_SECURITY.md (each with a review date the tests enforce). Any other advisory at or above the level fails.
//   node scripts/audit-gate.mjs --level=high [--omit=dev]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const args = process.argv.slice(2);
const level = args.find((arg) => arg.startsWith("--level="))?.slice(8) ?? "high";
const omitDev = args.includes("--omit=dev");

const policy = readFileSync(new URL("../docs/DEPENDENCY_SECURITY.md", import.meta.url), "utf8");
const excepted = new Set(policy.split(/\r?\n/).filter((line) => line.startsWith("| `GHSA-")).map((line) => line.match(/`(GHSA-[\w-]+)`/)[1]));

let output;
try {
  output = execFileSync("npm", ["audit", "--json", ...(omitDev ? ["--omit=dev"] : [])], { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  output = error.stdout;   // npm audit exits non-zero whenever it finds anything; the report is still on stdout
}
const report = JSON.parse(output);

const found = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via !== "object" || RANK[via.severity] < RANK[level]) continue;
    const id = via.url?.match(/GHSA-[\w-]+/)?.[0] ?? via.title;
    if (!excepted.has(id)) found.set(id, `${via.severity}: ${via.name} — ${via.title} (${via.url ?? "no link"})`);
  }
}

if (found.size) {
  console.error(`npm audit: ${found.size} advisor${found.size === 1 ? "y" : "ies"} at ${level} or above with no reviewed exception:`);
  for (const line of found.values()) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`npm audit${omitDev ? " (production)" : ""}: nothing at ${level} or above beyond the reviewed exceptions (${[...excepted].join(", ") || "none"}).`);
