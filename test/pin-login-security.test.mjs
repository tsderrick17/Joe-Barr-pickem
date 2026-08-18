import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("PIN sign-in monitors only failures without storing raw PINs or addresses", async () => {
  const [route, migration, page] = await Promise.all([
    readFile(new URL("../src/app/api/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260818010000_add_pin_attack_alerts.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /fetch\("\/api\/login"/);
  assert.match(route, /createHmac\("sha256"/);
  assert.match(route, /record_failed_pin_login/);
  assert.match(route, /clear_failed_pin_logins/);
  assert.ok(route.indexOf("record_failed_pin_login") > route.indexOf("if (error || !data.session)"));
  assert.match(migration, /count\(distinct pin_fingerprint\)/);
  assert.match(migration, /threshold <> 10/);
  assert.match(migration, /revoke all on table public\.pin_login_attempts, public\.pin_login_incidents from public, anon, authenticated/);
  assert.doesNotMatch(migration, /login_pin/);
});
