import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

function ignoreBuild(env) {
  return spawnSync(process.execPath, ["scripts/vercel-ignore-build.mjs"], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });
}

test("only main, preview/ branches and production deployments are built", () => {
  assert.equal(ignoreBuild({ VERCEL_GIT_COMMIT_REF: "main" }).status, 1, "main builds");
  assert.equal(ignoreBuild({ VERCEL_GIT_COMMIT_REF: "preview/ticket" }).status, 1, "preview/ branches build");
  assert.equal(ignoreBuild({ VERCEL_GIT_COMMIT_REF: "fix-something", VERCEL_ENV: "production" }).status, 1, "production builds");
  assert.equal(ignoreBuild({ VERCEL_GIT_COMMIT_REF: "fix-something", VERCEL_ENV: "preview" }).status, 0, "other branches skip");
  assert.equal(ignoreBuild({}).status, 0, "no branch skips");
});

test("vercel.json runs the ignored build step", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.ignoreCommand, "node scripts/vercel-ignore-build.mjs");
});

test("the dashboards read watchdog status without bundling the reminder worker and image renderer", async () => {
  for (const route of ["admin/grading-dashboard", "admin/operations-map"]) {
    const source = await readFile(new URL(`../src/app/api/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /from "@\/lib\/watchdog-status"/);
    assert.doesNotMatch(source, /from "@\/lib\/automation-watchdog"/);
  }
  const status = await readFile(new URL("../src/lib/watchdog-status.ts", import.meta.url), "utf8");
  assert.doesNotMatch(status, /reminder-worker|email-reminders|email-artwork|sharp/);
});
