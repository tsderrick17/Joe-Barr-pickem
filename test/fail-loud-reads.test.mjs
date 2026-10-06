import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a failed scoring-period read is not a missing week, and Board profile reads fail loud", async () => {
  const picks = await read("src/app/api/picks/route.ts");
  const board = await read("src/app/api/board/route.ts");
  assert.match(picks, /if \(periodError\) return NextResponse\.json\([^\n]*status: 503/);
  assert.ok(picks.indexOf("if (periodError)") < picks.indexOf("if (!period)"));
  assert.match(board, /if \(playerError\) \{\s*return NextResponse\.json\([^\n]*status: 503/);
  assert.ok(board.indexOf("if (playerError)") < board.indexOf("if (!player || !player.active)"));
});

test("a successful sign-in still reports a failure to clear old PIN attempts", async () => {
  const login = await read("src/app/api/login/route.ts");
  assert.match(login, /const \{ error: clearError \} = await supabaseAdmin\.rpc\("clear_failed_pin_logins"/);
  assert.match(login, /if \(clearError\) console\.error\(/);
});

test("the Bowl sync stops on a failed database read instead of looking like an empty season", async () => {
  const bowl = await read("src/lib/sync-bowl-pool.ts");
  assert.doesNotMatch(bowl, /const \{ data: [a-zA-Z]+ \} = await supabaseAdmin/);
  assert.equal((bowl.match(/ReadError\) throw new Error\(/g) ?? []).length, 6);
});

test("react and react-dom are the same version", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.dependencies["react-dom"], pkg.dependencies.react);
});

test("the commissioner gate retries a transient read and logs a persistent one", async () => {
  const gate = await read("src/lib/require-commissioner.ts");
  assert.match(gate, /const \{ data: player, error \} = await retrySafeRead\(/);
  assert.match(gate, /if \(error\) console\.error\(/);
  assert.match(gate, /return player\?\.active && player\.is_commissioner \? player : null;/, "still fails closed");
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
  assert.match(client, /Sentry\.replayIntegration\(\{/);
  assert.doesNotMatch(client, /@sentry\/replay|as unknown as/);
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.dependencies["@sentry/replay"], undefined);
  assert.equal(pkg.dependencies["js-yaml"], undefined);
});
