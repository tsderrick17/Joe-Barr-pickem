import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

globalThis.activePlayerSelectedColumns = [];
let authAttempts = 0;
let profileAttempts = 0;
let transientAuth = false;
let transientProfile = false;
globalThis.activePlayerAuthFixture = () => ({
  auth: {
    async getUser() {
      authAttempts += 1;
      if (transientAuth && authAttempts === 1) return { data: { user: null }, error: { status: 503 } };
      return { data: { user: { id: "auth-user-1" } }, error: null };
    },
  },
});
globalThis.activePlayerDatabase = {
  from(table) {
    assert.equal(table, "players");
    const query = {
      select(columns) { globalThis.activePlayerSelectedColumns.push(columns); return query; },
      eq() { return query; },
      async maybeSingle() {
        profileAttempts += 1;
        if (transientProfile && profileAttempts === 1) return { data: null, error: { status: 503 } };
        return {
          data: {
            id: "player-1", active: true, is_commissioner: false,
            show_survivor_standings: true, show_bowl_card: false, show_pool_chat: true,
            hide_pickem_eliminated_rows: false, hide_survivor_eliminated_rows: true,
          },
          error: null,
        };
      },
    };
    return query;
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@supabase/supabase-js") return {
      url: "data:text/javascript,export const createClient = globalThis.activePlayerAuthFixture;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.activePlayerDatabase;",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
process.env.SUPABASE_SECRET_KEY = "fixture-server-key";

const { authenticateActivePlayer } = await import("../src/lib/authenticate-active-player.ts");
const request = () => new Request("http://localhost", {
  headers: { authorization: "Bearer fixture-token" },
});

test("the shared verifier loads Home's preferences in the same active-player profile read", async () => {
  const access = await authenticateActivePlayer(request(), { includeStandingsPreferences: true });

  assert.equal(access.ok, true);
  assert.equal(access.player.id, "player-1");
  assert.equal(access.player.show_survivor_standings, true);
  assert.match(globalThis.activePlayerSelectedColumns[0], /show_survivor_standings/);
  assert.match(globalThis.activePlayerSelectedColumns[0], /hide_survivor_eliminated_rows/);
});

test("other routes retain the minimal player profile read", async () => {
  const access = await authenticateActivePlayer(request());

  assert.equal(access.ok, true);
  assert.equal(globalThis.activePlayerSelectedColumns[1], "id, active, is_commissioner");
});

test("the shared verifier can load the complete Profile settings in one player read", async () => {
  const access = await authenticateActivePlayer(request(), { includeProfilePreferences: true });

  assert.equal(access.ok, true);
  assert.match(globalThis.activePlayerSelectedColumns[2], /notification_email/);
  assert.match(globalThis.activePlayerSelectedColumns[2], /email_pick_due_primetime_enabled/);
  assert.match(globalThis.activePlayerSelectedColumns[2], /show_pool_action/);
  assert.match(globalThis.activePlayerSelectedColumns[2], /hide_survivor_eliminated_rows/);
});

test("request-scoped access retries only transient token and profile reads", async () => {
  authAttempts = 0;
  profileAttempts = 0;
  transientAuth = true;
  assert.equal((await authenticateActivePlayer(request())).ok, true);
  assert.equal(authAttempts, 2);
  assert.equal(profileAttempts, 1);

  authAttempts = 0;
  profileAttempts = 0;
  transientAuth = false;
  transientProfile = true;
  assert.equal((await authenticateActivePlayer(request())).ok, true);
  assert.equal(authAttempts, 1);
  assert.equal(profileAttempts, 2);
});
