import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("a healthy probe answer may sit in the CDN for its own window; a failing one never does", async () => {
  const { HEALTH_CDN_SECONDS, criticalWorkerCdnSeconds, healthProbeCacheControl } = await import("../src/lib/health-cache.ts");
  assert.equal(healthProbeCacheControl(true, 1200), "public, max-age=0, s-maxage=1200");
  assert.equal(healthProbeCacheControl(false, 1200), "no-store, max-age=0");
  // Each window is shorter than the shortest grace window its probe enforces itself (35 minutes, 12 minutes, 6 hours, 8 days).
  assert.ok(HEALTH_CDN_SECONDS.automation < 35 * 60);
  assert.ok(HEALTH_CDN_SECONDS.criticalWorkers < 12 * 60);
  // Each worker probe keeps a healthy answer inside its own grace window (line locks 12, scores 45, reminders 20 minutes).
  assert.ok(criticalWorkerCdnSeconds("line_locks") < 12 * 60);
  assert.ok(criticalWorkerCdnSeconds("scores") < 45 * 60 && criticalWorkerCdnSeconds("scores") > criticalWorkerCdnSeconds("line_locks"));
  assert.ok(criticalWorkerCdnSeconds("reminders") < 20 * 60 && criticalWorkerCdnSeconds("reminders") > criticalWorkerCdnSeconds("line_locks"));
  assert.equal(criticalWorkerCdnSeconds(), HEALTH_CDN_SECONDS.criticalWorkers, "the all-workers probe uses the shortest window");
  assert.ok(HEALTH_CDN_SECONDS.settlement < 6 * 3600);
  assert.ok(HEALTH_CDN_SECONDS.bowlPool <= 3600);
  assert.ok(HEALTH_CDN_SECONDS.backup < 8 * 86400);
  // The pool-integrity probes stay inside the grace each one enforces itself (20 minutes, 3 hours, 2 hours).
  assert.ok(HEALTH_CDN_SECONDS.lines < 20 * 60);
  assert.ok(HEALTH_CDN_SECONDS.recap < 3 * 3600);
  assert.ok(HEALTH_CDN_SECONDS.weekHandoff < 2 * 3600);
});

test("rule: every cached probe takes its Cache-Control from the shared helper with its own window", () => {
  const probes = {
    "src/app/api/health/automation/route.ts": "HEALTH_CDN_SECONDS.automation",
    "src/app/api/health/settlement/route.ts": "HEALTH_CDN_SECONDS.settlement",
    "src/app/api/health/bowl-pool/route.ts": "HEALTH_CDN_SECONDS.bowlPool",
    "src/app/api/health/backup/route.ts": "HEALTH_CDN_SECONDS.backup",
    "src/lib/critical-worker-health-route.ts": "criticalWorkerCdnSeconds(worker)",
    "src/lib/pool-integrity-route.ts": "healthProbeCacheControl(outcome.healthy, cdnSeconds)",
  };
  for (const [file, key] of Object.entries(probes)) assert.ok(read(file).includes(`healthProbeCacheControl(`) && read(file).includes(key), file);
});

test("the core availability probe always runs live: its answer is never cached, healthy or not", async () => {
  globalThis.healthProbeOutcome = { error: null };
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const stub = "data:text/javascript,const query = { select: () => ({ limit: async () => ({ data: [], error: globalThis.healthProbeOutcome.error }) }) }; ";
      if (specifier === "@/lib/supabase") return { url: `${stub}export const supabase = { from: () => query };`, shortCircuit: true };
      if (specifier === "@/lib/supabase-admin") return { url: `${stub}export const supabaseAdmin = { from: () => query };`, shortCircuit: true };
      return nextResolve(specifier, context);
    },
  });
  const probe = await import("../src/app/api/health/route.ts");
  const healthy = await probe.GET();
  assert.equal(healthy.status, 200);
  assert.equal(healthy.headers.get("cache-control"), "no-store, max-age=0");
  globalThis.healthProbeOutcome = { error: new Error("database unreachable") };
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const failing = await probe.GET();
    assert.equal(failing.status, 503);
    assert.equal(failing.headers.get("cache-control"), "no-store, max-age=0");
  } finally {
    console.error = originalError;
  }
});

test("the operations watchdog runs every fifteen minutes and preflight expects it", () => {
  const sql = read("supabase/migrations/20261030030000_background_job_cadence.sql");
  assert.match(sql, /cron\.schedule\('pickem-operations-watchdog-every-fifteen-minutes', '\*\/15 \* \* \* \*', watchdog_command\)/);
  assert.match(sql, /'pickem-operations-watchdog-every-ten-minutes',\s*'pickem-operations-watchdog-every-fifteen-minutes'/);
  assert.match(sql, /\('pickem-operations-watchdog-every-fifteen-minutes', 'Operations watchdog every fifteen minutes', '\*\/15 \* \* \* \*', '\/api\/cron\/watchdog', null::text\)/);
  assert.match(sql, /to_regprocedure\('cron\.schedule\(text,text,text\)'\) is not null/);
  // The weekly prune window catches exactly one fifteen-minute tick.
  assert.match(read("src/lib/automation-watchdog.ts"), /now\.getUTCHours\(\) === 13 && now\.getUTCMinutes\(\) < 15;/);
});
