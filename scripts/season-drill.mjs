import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(script) {
  const result = spawnSync(npm, ["run", script], {
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// This is deliberately a read-only orchestration command for production, and
// a write/cleanup exercise only when all isolated-test credentials are present.
run("test:all");

const isolated = process.env.PICKEM_E2E_ENABLED === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_SUPABASE_URL)
  && Boolean(process.env.PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY)
  && Boolean(process.env.PICKEM_TEST_SUPABASE_PUBLISHABLE_KEY);

if (!isolated) {
  console.log("\nSeason drill: logic and database safeguards passed. Browser player-flow checks are safely waiting for the isolated test project.");
  process.exit(0);
}

run("test:e2e");
console.log("\nSeason drill: logic, database safeguards, and isolated browser player flows passed.");
