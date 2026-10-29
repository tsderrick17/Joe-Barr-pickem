import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// A failed scoring-period read answering 503, not 404, runs in picks-route-read-failures.test.mjs; a sign-in that cannot clear old PIN attempts still succeeds but
// reports it, in pin-login-route.test.mjs; what the gate answers for an outage or an ordinary player runs in player-access-result.test.mjs.

test("the Bowl sync stops on a failed database read instead of looking like an empty season", async () => {
  const bowl = await read("src/lib/sync-bowl-pool.ts");
  assert.doesNotMatch(bowl, /const \{ data: [a-zA-Z]+ \} = await supabaseAdmin/);
  assert.equal((bowl.match(/ReadError\) throw new Error\(/g) ?? []).length, 6);
});

test("react and react-dom are the same version", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.dependencies["react-dom"], pkg.dependencies.react);
});

test("rule: the commissioner gate goes through the shared player authentication, which reads the profile with retries", async () => {
  const gate = await read("src/lib/require-commissioner.ts");
  assert.match(gate, /authenticateActivePlayer\(request, \{ profile: "named", requireCommissioner: true \}\)/);
  const auth = await read("src/lib/authenticate-active-player.ts");
  assert.match(auth, /retrySafeRead\(\(\) => players\(\)/);
});

test("the Bowl dispatcher uses the same Eastern August 1 season year as the app", async () => {
  const sql = await read("supabase/migrations/20260929040000_bowl_dispatch_eastern_season_year.sql");
  assert.match(sql, /season_year_value integer := extract\(year from \(clock_timestamp\(\) at time zone 'America\/New_York'\)\)::integer;/);
  assert.match(sql, /season_month integer := extract\(month from \(clock_timestamp\(\) at time zone 'America\/New_York'\)\)::integer;/);
  assert.match(sql, /if season_month < 8 then season_year_value := season_year_value - 1; end if;/);
  assert.match(sql, /net\.http_post/, "preflight still recognizes the gated dispatcher");
  assert.match(sql, /decrypted_secrets/);
  assert.match(sql, /grant execute on function public\.dispatch_bowl_sync_if_due\(\) to service_role;/);
});

test("Sentry uses one SDK version with its own replay, and unused packages are gone", async () => {
  const client = await read("instrumentation-client.ts");
  const replay = await read("src/lib/sentry-replay.ts");
  assert.match(replay, /Sentry\.replayIntegration\(\{/);
  assert.doesNotMatch(client + replay, /@sentry\/replay|as unknown as/);
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.dependencies["@sentry/replay"], undefined);
  assert.equal(pkg.dependencies["js-yaml"], undefined);
});
