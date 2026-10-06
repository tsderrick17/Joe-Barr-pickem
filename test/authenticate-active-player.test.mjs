import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

let authAttempts = 0;
let profileAttempts = 0;
let transientAuth = false;
let transientProfile = false;
globalThis.activePlayerAuthFixture = () => ({
  auth: {
    async getUser() {
      authAttempts += 1;
      if (transientAuth && authAttempts === 1) return { data: { user: null }, error: { status: 503 } };
      return { data: { user: { id: "auth-1" } }, error: null };
    },
  },
});
globalThis.activePlayerDatabaseFixture = {
  from(table) {
    assert.equal(table, "players");
    return {
      select() { return this; },
      eq() { return this; },
      async maybeSingle() {
        profileAttempts += 1;
        if (transientProfile && profileAttempts === 1) return { data: null, error: { status: 503 } };
        return { data: { id: "player-1", active: true, is_commissioner: false }, error: null };
      },
    };
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@supabase/supabase-js") return {
      url: "data:text/javascript,export const createClient = globalThis.activePlayerAuthFixture;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.activePlayerDatabaseFixture;",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
process.env.SUPABASE_SECRET_KEY = "fixture-server-key";
const { authenticateActivePlayer } = await import("../src/lib/authenticate-active-player.ts");
const request = () => new Request("http://localhost/api/picks", { headers: { authorization: "Bearer fixture-token" } });

test("request-scoped access retries only transient token and profile reads", async () => {
  transientAuth = true;
  assert.deepEqual(await authenticateActivePlayer(request()), {
    ok: true,
    player: { id: "player-1", active: true, is_commissioner: false },
  });
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
