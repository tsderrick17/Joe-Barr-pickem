import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function routeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(file);
    return entry.name === "route.ts" ? [file] : [];
  }));
  return nested.flat();
}

test("every commissioner route uses the shared commissioner gate", async () => {
  const adminDirectory = path.join(root, "src", "app", "api", "admin");
  const routes = await routeFiles(adminDirectory);
  assert.ok(routes.length > 0, "expected commissioner routes");

  for (const route of routes) {
    const source = await readFile(route, "utf8");
    assert.match(source, /requireCommissioner/, `${path.relative(root, route)} must use requireCommissioner`);
  }
});

test("scheduled mutation routes require their automation secret before doing work", async () => {
  const cronDirectory = path.join(root, "src", "app", "api", "cron");
  const routes = await routeFiles(cronDirectory);
  assert.deepEqual(routes.map((route) => path.basename(path.dirname(route))).sort(), ["bootstrap-season", "lock-lines", "send-reminders", "sync-scores", "watchdog"]);

  for (const route of routes) {
    const source = await readFile(route, "utf8");
    assert.match(source, /authorization/, `${path.relative(root, route)} must read Authorization`);
    assert.match(source, /Bearer/, `${path.relative(root, route)} must require the bearer secret`);
    assert.match(source, /runWithAutomationLease/, `${path.relative(root, route)} must prevent overlapping runs`);
  }
});

test("manual recovery controls share the same overlap protection as automation", async () => {
  const protectedRoutes = [
    "src/app/api/admin/import-full-schedule/route.ts",
    "src/app/api/admin/import-games/route.ts",
    "src/app/api/admin/season-bootstrap-status/route.ts",
    "src/app/api/admin/watchdog/route.ts",
  ];
  for (const route of protectedRoutes) {
    const source = await readFile(path.join(root, route), "utf8");
    assert.match(source, /runWithAutomationLease/, `${route} must prevent overlap with a scheduled run`);
  }
});
