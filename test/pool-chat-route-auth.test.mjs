import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

globalThis.poolChatRouteAccess = { ok: false, status: 401, code: "session_invalid" };
globalThis.poolChatRouteAccessCalls = 0;
globalThis.poolChatRouteDatabaseCalls = 0;
globalThis.poolChatRouteDatabase = {
  from() { globalThis.poolChatRouteDatabaseCalls++; throw new Error("Access failures must stop before chat reads or writes"); },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return {
      url: "data:text/javascript,export async function authenticateActivePlayer(){ globalThis.poolChatRouteAccessCalls++; return globalThis.poolChatRouteAccess; }",
      shortCircuit: true,
    };
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.poolChatRouteDatabase;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/player-activity") return {
      url: "data:text/javascript,export async function recordPlayerActivity(){ throw new Error('Access failures must stop before activity writes'); }",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

const { GET, POST, DELETE } = await import("../src/app/api/pool-chat/route.ts");

test("Pool Chat preserves shared access failures across read, send, and delete", async () => {
  const handlers = [
    [GET, new Request("http://localhost/api/pool-chat")],
    [POST, new Request("http://localhost/api/pool-chat", { method: "POST", body: JSON.stringify({ message: "hello" }) })],
    [DELETE, new Request("http://localhost/api/pool-chat", { method: "DELETE", body: JSON.stringify({ messageId: "message-1" }) })],
  ];

  for (const access of [
    { status: 401, code: "session_invalid" },
    { status: 403, code: "player_inactive" },
    { status: 500, code: "auth_not_configured" },
    { status: 503, code: "profile_unavailable" },
  ]) {
    globalThis.poolChatRouteAccess = { ok: false, ...access };
    for (const [handler, request] of handlers) {
      const response = await handler(request);
      assert.equal(response.status, access.status);
      assert.equal((await response.json()).code, access.code);
    }
  }

  assert.equal(globalThis.poolChatRouteAccessCalls, 12);
  assert.equal(globalThis.poolChatRouteDatabaseCalls, 0);
});
