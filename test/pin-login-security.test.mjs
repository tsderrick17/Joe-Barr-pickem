import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("PIN sign-in uses protected Auth credentials and monitors only privacy-safe failures", async () => {
  const [route, migration, page, players, rotation, authentication] = await Promise.all([
    readFile(new URL("../src/app/api/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818010000_add_pin_attack_alerts.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/players/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/security/player-credentials/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/player-pin-authentication.js", import.meta.url), "utf8"),
  ]);
  assert.match(page, /fetch\("\/api\/login"/);
  assert.match(page, /name="password"/);
  assert.match(page, /autoComplete="current-password"/);
  assert.doesNotMatch(page, /autoComplete="one-time-code"/);
  assert.match(route, /createHmac\("sha256"/);
  assert.match(route, /record_failed_pin_login/);
  assert.match(route, /clear_failed_pin_logins/);
  assert.match(route, /authenticatePlayerPin/);
  assert.match(authentication, /derivePlayerAuthPassword/);
  assert.doesNotMatch(authentication, /legacyPlayerAuthPassword/);
  assert.doesNotMatch(authentication, /updateAccount/);
  assert.ok(route.indexOf("record_failed_pin_login") > route.indexOf("if (error || !data.session)"));
  assert.match(players, /derivePlayerAuthPassword/);
  assert.doesNotMatch(players, /password\s*=\s*`pickem-/);
  assert.match(rotation, /HARDEN PLAYER SIGN-INS/);
  assert.match(rotation, /player_auth_hardened/);
  assert.doesNotMatch(rotation, /login_pin[^\n]*details/);
  assert.match(migration, /count\(distinct pin_fingerprint\)/);
  assert.match(migration, /threshold <> 10/);
  assert.match(migration, /revoke all on table public\.pin_login_attempts, public\.pin_login_incidents from public, anon, authenticated/);
  assert.doesNotMatch(migration, /login_pin/);
});
