import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

globalThis.homeRouteAccess = { ok: false, status: 401, code: "session_invalid" };
globalThis.homeRouteAccessCalls = 0;
globalThis.homeRouteAccessOptions = [];
globalThis.homeRouteDatabaseCalls = 0;
globalThis.homeRouteDatabase = {
  from() { globalThis.homeRouteDatabaseCalls++; throw new Error("Access failures must stop before Home reads"); },
  rpc() { globalThis.homeRouteDatabaseCalls++; throw new Error("Access failures must stop before Home writes"); },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return {
      url: "data:text/javascript,export async function authenticateActivePlayer(_request, options){ globalThis.homeRouteAccessCalls++; globalThis.homeRouteAccessOptions.push(options); return globalThis.homeRouteAccess; }",
      shortCircuit: true,
    };
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.homeRouteDatabase;",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

const { GET } = await import("../src/app/api/home/route.ts");

test("Home uses the shared access result with its existing preference fields", async () => {
  for (const access of [
    { status: 401, code: "session_invalid" },
    { status: 403, code: "player_inactive" },
    { status: 500, code: "auth_not_configured" },
    { status: 503, code: "profile_unavailable" },
  ]) {
    globalThis.homeRouteAccess = { ok: false, ...access };
    const response = await GET(new Request("http://localhost/api/home"));
    assert.equal(response.status, access.status);
    assert.equal((await response.json()).code, access.code);
  }
  assert.equal(globalThis.homeRouteAccessCalls, 4);
  assert.ok(globalThis.homeRouteAccessOptions.every((options) => options.includeStandingsPreferences === true));
  assert.equal(globalThis.homeRouteDatabaseCalls, 0);
});
