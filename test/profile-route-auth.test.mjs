import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

globalThis.profileRouteAccess = { ok: false, status: 401, code: "session_invalid" };
globalThis.profileRouteAccessCalls = 0;
globalThis.profileRouteAccessOptions = [];
globalThis.profileRouteDatabaseCalls = 0;
globalThis.profileRouteDatabase = {
  from() { globalThis.profileRouteDatabaseCalls++; throw new Error("Access failures must stop before profile writes"); },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return {
      url: "data:text/javascript,export async function authenticateActivePlayer(_request, options){ globalThis.profileRouteAccessCalls++; globalThis.profileRouteAccessOptions.push(options); return globalThis.profileRouteAccess; }",
      shortCircuit: true,
    };
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.profileRouteDatabase;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/player-activity") return {
      url: "data:text/javascript,export async function recordPlayerActivity(){ throw new Error('Access failures must stop before activity writes'); }",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

const { GET, PUT } = await import("../src/app/api/profile/route.ts");

test("Profile reads and updates preserve shared access failures", async () => {
  for (const access of [
    { status: 401, code: "session_invalid" },
    { status: 403, code: "player_inactive" },
    { status: 500, code: "auth_not_configured" },
    { status: 503, code: "profile_unavailable" },
  ]) {
    globalThis.profileRouteAccess = { ok: false, ...access };
    for (const [handler, request] of [
      [GET, new Request("http://localhost/api/profile")],
      [PUT, new Request("http://localhost/api/profile", { method: "PUT", body: JSON.stringify({ showPoolChat: false }) })],
    ]) {
      const response = await handler(request);
      assert.equal(response.status, access.status);
      assert.equal((await response.json()).code, access.code);
    }
  }

  assert.equal(globalThis.profileRouteAccessCalls, 8);
  assert.ok(globalThis.profileRouteAccessOptions.every((options) => options.includeProfilePreferences === true));
  assert.equal(globalThis.profileRouteDatabaseCalls, 0);
});

test("Profile updates reject valid JSON that is not a settings object", async () => {
  globalThis.profileRouteAccess = { ok: true, player: { id: "player-1" } };

  for (const body of ["null", "[]", '"settings"']) {
    const response = await PUT(new Request("http://localhost/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Your notification settings were incomplete.");
  }

  assert.equal(globalThis.profileRouteDatabaseCalls, 0);
});
