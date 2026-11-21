import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { derivePlayerAuthPassword, PLAYER_AUTH_CREDENTIAL_VERSION, playerAuthEmail } from "../src/lib/player-auth-credential.js";
import { authenticatePlayerPin } from "../src/lib/player-pin-authentication.js";

// The player rules that each needed only a test or two, kept together. Each block is one rule's tests, named for the file it came from.

// player-activity
{
  test("Commissioner player list exposes a coarse last-active timestamp without activity details", async () => {
    const [migration, route, helper] = await Promise.all([
      readFile(new URL("../supabase/migrations/20260818022000_add_player_last_activity.sql", import.meta.url), "utf8"),
      readFile(new URL("../src/app/api/admin/players/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/lib/player-activity.ts", import.meta.url), "utf8"),
    ]);
    assert.match(migration, /last_active_at timestamptz/);
    assert.match(route, /last_active_at/);
    assert.match(route, /lastActiveAt/);
    assert.match(helper, /last_active_at/);
  });
}

// player-auth-credential
{
  test("player Auth credentials are deterministic, strong, and not the PIN", () => {
    const secret = "s".repeat(64);
    const first = derivePlayerAuthPassword("1234", secret);
    const same = derivePlayerAuthPassword("1234", secret);
    const otherPin = derivePlayerAuthPassword("1235", secret);
    const otherSecret = derivePlayerAuthPassword("1234", "t".repeat(64));

    assert.equal(first, same);
    assert.notEqual(first, otherPin);
    assert.notEqual(first, otherSecret);
    assert.equal(first.includes("1234"), false);
    assert.ok(first.length >= 40);
    assert.equal(playerAuthEmail("1234"), "pin-1234@pickemjb.app");
    assert.equal(PLAYER_AUTH_CREDENTIAL_VERSION, 2);
  });

  test("player Auth credential derivation rejects malformed PINs and weak secrets", () => {
    assert.throws(() => derivePlayerAuthPassword("123", "s".repeat(64)), /four-digit PIN/);
    assert.throws(() => derivePlayerAuthPassword("1234", "short"), /strong server credential/);
  });
}

// player-pin-authentication
{
  const secret = "server-secret-".padEnd(64, "x");
  const user = { id: "user-1", app_metadata: { existing: true } };
  const session = { access_token: "access", refresh_token: "refresh" };

  test("a player signs in with only the protected Auth credential", async () => {
    const calls = [];
    const result = await authenticatePlayerPin({
      pin: "1234",
      serverSecret: secret,
      signIn: async (credentials) => {
        calls.push(credentials);
        return { data: { user, session }, error: null };
      },
    });

    assert.equal(result.auth.data.session, session);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].password, derivePlayerAuthPassword("1234", secret));
  });

  test("an invalid protected credential is returned for normal failure handling", async () => {
    const result = await authenticatePlayerPin({
      pin: "1234",
      serverSecret: secret,
      signIn: async () => ({ data: { user: null, session: null }, error: new Error("invalid") }),
    });

    assert.equal(result.auth.data.session, null);
    assert.ok(result.auth.error);
  });
}
