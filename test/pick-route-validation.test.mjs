import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

let readsOrWrites = 0;
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
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
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
});
