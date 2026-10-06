import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

let readsOrWrites = 0;
globalThis.pickRouteAccessResult = { ok: false, status: 401, code: "session_invalid" };
globalThis.pickRouteValidationDatabase = {
  from() { readsOrWrites++; throw new Error("Malformed input must not reach the database"); },
  rpc() { readsOrWrites++; throw new Error("Malformed input must not reach an RPC"); },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.pickRouteValidationDatabase;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/authenticate-active-player") return {
      url: "data:text/javascript,export async function authenticateActivePlayer(){ globalThis.pickRouteAccessChecks++; return globalThis.pickRouteAccessResult; }",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
globalThis.pickRouteAccessChecks = 0;
const { POST } = await import("../src/app/api/picks/route.ts");

test("malformed pick saves return 400 before database access", async () => {
  for (const body of ["{", "null", JSON.stringify({ scoringPeriodId: "week-3", selections: [null] }),
    JSON.stringify({ scoringPeriodId: "week-3", selections: [], survivorSelection: { gameId: "g1" } })]) {
    const response = await POST(new Request("http://localhost/api/picks", {
      method: "POST", headers: { authorization: "Bearer fixture-token" }, body,
    }));
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
  assert.equal(readsOrWrites, 0);
  assert.equal(globalThis.pickRouteAccessChecks, 0);
});

test("pick saves preserve shared access failure statuses and codes", async () => {
  for (const access of [
    { ok: false, status: 401, code: "session_invalid" },
    { ok: false, status: 403, code: "player_inactive" },
    { ok: false, status: 500, code: "auth_not_configured" },
    { ok: false, status: 503, code: "profile_unavailable" },
  ]) {
    globalThis.pickRouteAccessResult = access;
    const response = await POST(new Request("http://localhost/api/picks", {
      method: "POST", headers: { authorization: "Bearer fixture-token" },
      body: JSON.stringify({ scoringPeriodId: "week-3", selections: [] }),
    }));
    assert.equal(response.status, access.status);
    assert.equal((await response.json()).code, access.code);
  }
  assert.equal(globalThis.pickRouteAccessChecks, 4);
  assert.equal(readsOrWrites, 0);
});
