import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

let accessCalls = 0;
let databaseCalls = 0;
let accessResult = { ok: false, status: 401, code: "session_invalid" };
globalThis.pickRouteAccessFixture = async () => {
  accessCalls += 1;
  return accessResult;
};
globalThis.pickRouteAuthDatabase = {
  from() { databaseCalls += 1; throw new Error("Denied access must not read pool data."); },
  rpc() { databaseCalls += 1; throw new Error("Denied access must not mutate pool data."); },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return {
      url: "data:text/javascript,export const authenticateActivePlayer = globalThis.pickRouteAccessFixture;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.pickRouteAuthDatabase;",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { POST } = await import("../src/app/api/picks/route.ts");

function request(body = { scoringPeriodId: "week-3", selections: [] }, authorization = "Bearer fixture-token") {
  return new Request("http://localhost/api/picks", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("pick saves reject missing credentials and malformed input before access reads", async () => {
  assert.equal((await POST(request(undefined, ""))).status, 401);
  assert.equal((await POST(request({ scoringPeriodId: "week-3", selections: [null] }))).status, 400);
  assert.equal(accessCalls, 0);
  assert.equal(databaseCalls, 0);
});

test("pick save access failures retain safe statuses and never reach pool data", async () => {
  for (const [status, code, message] of [
    [401, "session_invalid", "Your sign-in session could not be verified."],
    [403, "player_inactive", "Your player profile is not active in this Pick'em."],
    [503, "auth_unavailable", "The sign-in service could not be reached. Please try again in a minute."],
    [503, "profile_unavailable", "Pick'em is having trouble reaching its records right now. Please try again in a minute."],
    [500, "auth_not_configured", "The server is missing required configuration."],
  ]) {
    accessResult = { ok: false, status, code };
    const response = await POST(request());
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: message, code });
  }
  assert.equal(accessCalls, 5);
  assert.equal(databaseCalls, 0);
});
