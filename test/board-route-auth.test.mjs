import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

globalThis.boardRouteAccess = { ok: false, status: 401, code: "session_invalid" };
globalThis.boardRouteAccessCalls = 0;
globalThis.boardRouteDatabaseCalls = 0;
globalThis.boardRouteDatabase = {
  from() { globalThis.boardRouteDatabaseCalls++; throw new Error("Access failures must stop before Slate reads"); },
  rpc() { globalThis.boardRouteDatabaseCalls++; throw new Error("Access failures must stop before Slate writes"); },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return {
      url: "data:text/javascript,export async function authenticateActivePlayer(){ globalThis.boardRouteAccessCalls++; return globalThis.boardRouteAccess; }",
      shortCircuit: true,
    };
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.boardRouteDatabase;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/player-activity") return {
      url: "data:text/javascript,export async function recordPlayerActivity(){ throw new Error('Access failures must not record activity'); }",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

const { GET } = await import("../src/app/api/board/route.ts");

test("Slate read failures keep shared access statuses and stop before data access", async () => {
  for (const access of [
    { status: 401, code: "session_invalid" },
    { status: 403, code: "player_inactive" },
    { status: 500, code: "auth_not_configured" },
    { status: 503, code: "profile_unavailable" },
  ]) {
    globalThis.boardRouteAccess = { ok: false, ...access };
    const response = await GET(new Request("http://localhost/api/board?bootstrap=1", {
      headers: { authorization: "Bearer fixture-token" },
    }));
    assert.equal(response.status, access.status);
    assert.equal((await response.json()).code, access.code);
  }
  assert.equal(globalThis.boardRouteAccessCalls, 4);
  assert.equal(globalThis.boardRouteDatabaseCalls, 0);
});
