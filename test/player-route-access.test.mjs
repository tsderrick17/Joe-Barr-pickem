import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

let accessResult = { ok: false, status: 401, code: "session_invalid" };
let accessOptions = [];
let databaseCalls = 0;
globalThis.playerRouteAccessFixture = async (_request, options) => {
  accessOptions.push(options);
  return accessResult;
};
globalThis.playerRouteAccessDatabase = {
  from() { databaseCalls += 1; throw new Error("Denied access must not read pool records."); },
  rpc() { databaseCalls += 1; throw new Error("Denied access must not mutate pool records."); },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return {
      url: "data:text/javascript,export const authenticateActivePlayer = globalThis.playerRouteAccessFixture;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.playerRouteAccessDatabase;",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

const [{ GET: home }, { GET: board }, { GET: survivor, POST: saveSurvivor }, { GET: bowl, POST: saveBowl }] = await Promise.all([
  import("../src/app/api/home/route.ts"),
  import("../src/app/api/board/route.ts"),
  import("../src/app/api/survivor/route.ts"),
  import("../src/app/api/bowl-pool/route.ts"),
]);

function request(path, method = "GET") {
  return new Request(`http://localhost/api/${path}`, {
    method,
    headers: { authorization: "Bearer fixture-token", "content-type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify({ scoringPeriodId: "week-3" }) } : {}),
  });
}

test("player read and Survivor mutation routes stop before pool data when access fails", async () => {
  const routes = [
    () => home(request("home")),
    () => board(request("board")),
    () => survivor(request("survivor")),
    () => saveSurvivor(request("survivor", "POST")),
    () => bowl(request("bowl-pool")),
    () => saveBowl(request("bowl-pool", "POST")),
  ];
  for (const [status, code] of [
    [401, "session_invalid"],
    [403, "player_inactive"],
    [503, "auth_unavailable"],
    [503, "profile_unavailable"],
    [500, "auth_not_configured"],
  ]) {
    accessResult = { ok: false, status, code };
    for (const route of routes) {
      const response = await route();
      assert.equal(response.status, status, `${code} returned the wrong status`);
      const body = await response.json();
      assert.ok(body.error);
      if (code === "auth_unavailable") assert.match(body.error, /sign-in service/);
      if (code === "profile_unavailable") assert.match(body.error, /records/);
    }
  }
  assert.equal(databaseCalls, 0);
  assert.equal(accessOptions.filter((options) => options?.profile === "home").length, 5);
});
