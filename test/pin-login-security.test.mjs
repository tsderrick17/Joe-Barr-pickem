import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// How a PIN sign-in behaves (fingerprints only, cooldown, hardened password, clearing failures) is run in pin-login-route.test.mjs. What stays here are the
// rules about how the rest of the code is put together, which no single behavior test can show.
test("every place that creates a player's sign-in password derives the hardened one, and the attack-alert tables are private", async () => {
  const [migration, players, rotation, authentication] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260818010000_add_pin_attack_alerts.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/players/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/security/player-credentials/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/player-pin-authentication.js", import.meta.url), "utf8"),
  ]);
  assert.match(authentication, /derivePlayerAuthPassword/);
  assert.doesNotMatch(authentication, /legacyPlayerAuthPassword/);
  assert.doesNotMatch(authentication, /updateAccount/);
  assert.match(players, /derivePlayerAuthPassword/);
  assert.doesNotMatch(players, /password\s*=\s*`pickem-/);
  assert.match(rotation, /player_auth_hardened/);
  assert.doesNotMatch(rotation, /login_pin[^\n]*details/, "the audit record never carries a PIN");
  assert.match(migration, /count\(distinct pin_fingerprint\)/);
  assert.match(migration, /threshold <> 10/);
  assert.match(migration, /revoke all on table public\.pin_login_attempts, public\.pin_login_incidents from public, anon, authenticated/);
  assert.doesNotMatch(migration, /login_pin/);
});
