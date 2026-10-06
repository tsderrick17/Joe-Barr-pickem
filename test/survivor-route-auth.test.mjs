import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

globalThis.survivorRouteAccess = { ok: false, status: 401, code: "session_invalid" };
globalThis.survivorRouteAccessCalls = 0;
globalThis.survivorRouteDatabaseCalls = 0;
globalThis.survivorRouteDatabase = {
  from() { globalThis.survivorRouteDatabaseCalls++; throw new Error("Access failures must stop before data reads"); },
  rpc() { globalThis.survivorRouteDatabaseCalls++; throw new Error("Access failures must stop before mutations"); },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return {
      url: "data:text/javascript,export async function authenticateActivePlayer(){ globalThis.survivorRouteAccessCalls++; return globalThis.survivorRouteAccess; }",
      shortCircuit: true,
    };
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.survivorRouteDatabase;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/player-activity") return {
      url: "data:text/javascript,export async function recordPlayerActivity(){ throw new Error('Access failures must not record activity'); }",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

const { GET, POST } = await import("../src/app/api/survivor/route.ts");

test("Survivor routes preserve shared access statuses and stable error codes", async () => {
  const cases = [
    { status: 401, code: "session_invalid" },
    { status: 403, code: "player_inactive" },
    { status: 500, code: "auth_not_configured" },
    { status: 503, code: "profile_unavailable" },
  ];

  for (const access of cases) {
    globalThis.survivorRouteAccess = { ok: false, ...access };
    for (const handler of [GET, POST]) {
      const response = await handler(new Request("http://localhost/api/survivor", { method: handler === GET ? "GET" : "POST" }));
      assert.equal(response.status, access.status);
      assert.equal((await response.json()).code, access.code);
    }
  }
  assert.equal(globalThis.survivorRouteAccessCalls, cases.length * 2);
  assert.equal(globalThis.survivorRouteDatabaseCalls, 0);
});
