import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

// The sign-in check verifies a session token locally against the project's public signing key (ES256), with the real
// Supabase client and a key pair made here. The network is replaced: the signing keys come from a stub, and any call to
// the Auth server itself is counted (it should only happen for a token signed with a key the project does not publish).
const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const otherKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicJwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "pool-key", alg: "ES256", use: "sig", key_ops: ["verify"] };

const encode = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
async function sessionToken({ sub = "auth-1", expiresIn = 3600, kid = "pool-key", signWith = keys.privateKey } = {}) {
  const header = encode({ alg: "ES256", typ: "JWT", kid });
  const payload = encode({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + expiresIn });
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signWith, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${Buffer.from(signature).toString("base64url")}`;
}

let authServerCalls = 0;
let jwksCalls = 0;
globalThis.fetch = async (input) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.endsWith("/auth/v1/.well-known/jwks.json")) {
    jwksCalls += 1;
    return new Response(JSON.stringify({ keys: [publicJwk] }), { headers: { "content-type": "application/json" } });
  }
  if (url.includes("/auth/v1/user")) {
    authServerCalls += 1;
    return new Response(JSON.stringify({ code: 403, error_code: "bad_jwt", msg: "invalid JWT" }), { status: 403, headers: { "content-type": "application/json" } });
  }
  throw new Error(`Unexpected request in the sign-in test: ${url}`);
};

const players = { "auth-1": { id: "player-1", active: true, is_commissioner: false }, "auth-2": { id: "player-2", active: false, is_commissioner: false } };
globalThis.localSignInDatabase = {
  from() {
    let authUserId = null;
    return {
      select() { return this; },
      eq(_column, value) { authUserId = value; return this; },
      async maybeSingle() { return { data: players[authUserId] ?? null, error: null }; },
    };
  },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.localSignInDatabase;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://pool.fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
process.env.SUPABASE_SECRET_KEY = "fixture-server-key";
const { authenticateActivePlayer } = await import("../src/lib/authenticate-active-player.ts");
const request = (token) => new Request("http://localhost/api/home", { headers: { authorization: `Bearer ${token}` } });

test("a valid session is accepted without asking the Auth server, and the signing keys are fetched once", async () => {
  assert.deepEqual(await authenticateActivePlayer(request(await sessionToken())), { ok: true, player: players["auth-1"] });
  assert.equal((await authenticateActivePlayer(request(await sessionToken()))).ok, true);
  assert.equal(authServerCalls, 0);
  assert.equal(jwksCalls, 1);
});

test("an expired session, a forged signature and a token that is not a session are refused as signed out", async () => {
  for (const token of [await sessionToken({ expiresIn: -60 }), await sessionToken({ signWith: otherKeys.privateKey }), "not-a-token"]) {
    assert.deepEqual(await authenticateActivePlayer(request(token)), { ok: false, status: 401, code: "session_invalid" });
  }
});

test("a key the project does not publish is checked with the Auth server, which refuses it", async () => {
  authServerCalls = 0;
  assert.deepEqual(await authenticateActivePlayer(request(await sessionToken({ kid: "unknown-key", signWith: otherKeys.privateKey }))), { ok: false, status: 401, code: "session_invalid" });
  assert.equal(authServerCalls, 1);
});

test("a deactivated player is refused at once, even with a valid session", async () => {
  assert.deepEqual(await authenticateActivePlayer(request(await sessionToken({ sub: "auth-2" }))), { ok: false, status: 403, code: "player_inactive" });
});
