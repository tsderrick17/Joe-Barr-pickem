import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("healthy uptime probes are CDN-cached within their own freshness windows; failures never are", async () => {
  const cache = read("src/lib/health-cache.ts");
  assert.match(cache, /return healthy \? `public, max-age=0, s-maxage=\$\{cdnSeconds\}` : "no-store, max-age=0";/);
  // Each cache window stays well under the probe's own grace window.
  assert.match(cache, /automation: 600,/);
  assert.match(cache, /criticalWorkers: 600,/);
  assert.match(cache, /settlement: 900,/);
  assert.match(cache, /bowlPool: 900,/);
  assert.match(cache, /backup: 3600,/);
  const probes = {
    "src/app/api/health/automation/route.ts": "HEALTH_CDN_SECONDS.automation",
    "src/app/api/health/settlement/route.ts": "HEALTH_CDN_SECONDS.settlement",
    "src/app/api/health/bowl-pool/route.ts": "HEALTH_CDN_SECONDS.bowlPool",
    "src/app/api/health/backup/route.ts": "HEALTH_CDN_SECONDS.backup",
    "src/lib/critical-worker-health-route.ts": "HEALTH_CDN_SECONDS.criticalWorkers",
  };
  for (const [file, key] of Object.entries(probes)) assert.ok(read(file).includes(`healthProbeCacheControl(`) && read(file).includes(key), file);
  // The core availability probe always runs live.
  assert.doesNotMatch(read("src/app/api/health/route.ts"), /s-maxage|healthProbeCacheControl/);
});

test("the operations watchdog runs every ten minutes and preflight expects it", () => {
  const sql = read("supabase/migrations/20261001010000_watchdog_every_ten_minutes.sql");
  assert.match(sql, /cron\.schedule\('pickem-operations-watchdog-every-ten-minutes', '\*\/10 \* \* \* \*', command_text\)/);
  assert.match(sql, /'pickem-operations-watchdog-every-five-minutes',\s*'pickem-operations-watchdog-every-ten-minutes'/);
  assert.match(sql, /\('pickem-operations-watchdog-every-ten-minutes', 'Operations watchdog every ten minutes', '\*\/10 \* \* \* \*', '\/api\/cron\/watchdog', null::text\)/);
  assert.match(sql, /to_regprocedure\('cron\.schedule\(text,text,text\)'\) is not null/);
  // The weekly prune window still catches a ten-minute tick.
  assert.match(read("src/lib/automation-watchdog.ts"), /now\.getUTCHours\(\) === 13 && now\.getUTCMinutes\(\) < 10;/);
});
