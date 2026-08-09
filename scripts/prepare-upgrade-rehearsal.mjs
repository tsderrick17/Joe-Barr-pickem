import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const requested = { ...packageJson.dependencies, ...packageJson.devDependencies };
const packages = Object.keys(requested).sort().map((name) => `${name}@latest`);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
mkdirSync("artifacts", { recursive: true });
const reportPath = "artifacts/upgrade-rehearsal.json";
const writeReport = (status, extra = {}) => writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(), status, requested,
  note: "Ephemeral rehearsal only. No package or lockfile changes are committed or deployed.",
  ...extra,
}, null, 2)}\n`);
writeReport("installing");
const install = spawnSync(npm, ["install", "--no-save", "--package-lock=false", "--ignore-scripts=false", ...packages], { stdio: "inherit" });
if (install.status !== 0) {
  writeReport("install-failed", { exitCode: install.status ?? 1 });
  process.exit(install.status ?? 1);
}
const installed = Object.fromEntries(Object.keys(requested).sort().map((name) => {
  const manifest = JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8"));
  return [name, manifest.version];
}));
writeReport("installed", { installed });
