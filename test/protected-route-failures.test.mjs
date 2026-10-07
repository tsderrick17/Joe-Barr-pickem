import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

let result = { ok: true, player: { id: "c1", first_name: "Dana", active: true, is_commissioner: true } };
let databaseCalls = 0;
globalThis.protectedFixtureAuth = async () => result;
globalThis.protectedFixtureDatabase = {
  from() { databaseCalls += 1; throw new Error("reached the database"); },
  rpc() { databaseCalls += 1; throw new Error("reached the database"); },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return { url: "data:text/javascript,export const authenticateActivePlayer = globalThis.protectedFixtureAuth;", shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.protectedFixtureDatabase;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";

const get = () => new Request("http://localhost/x", { headers: { authorization: "Bearer fixture" } });
const send = (method, body) => new Request("http://localhost/x", { method, headers: { authorization: "Bearer fixture", "content-type": "application/json" }, body: JSON.stringify(body) });

// A representative route of each kind that uses the shared result: Commissioner reads and writes, and the profile and chat routes.
const routes = [
  ["admin/players GET", () => import("../src/app/api/admin/players/route.ts").then((module) => module.GET(get()))],
  ["admin/reminders GET", () => import("../src/app/api/admin/reminders/route.ts").then((module) => module.GET(get()))],
  ["admin/game-disruptions POST", () => import("../src/app/api/admin/game-disruptions/route.ts").then((module) => module.POST(send("POST", { gameId: "g1", status: "postponed" })))],
  ["admin/bowl-pool/exceptions POST", () => import("../src/app/api/admin/bowl-pool/exceptions/route.ts").then((module) => module.POST(send("POST", { gameId: "g1", status: "cancelled" })))],
  ["profile GET", () => import("../src/app/api/profile/route.ts").then((module) => module.GET(get()))],
  ["pool-chat POST", () => import("../src/app/api/pool-chat/route.ts").then((module) => module.POST(send("POST", { message: "hi" })))],
];

const FAILURES = [
  { result: { ok: false, status: 401, code: "session_invalid" }, status: 401 },
  { result: { ok: false, status: 503, code: "auth_unavailable" }, status: 503 },
  { result: { ok: false, status: 503, code: "profile_unavailable" }, status: 503 },
  { result: { ok: false, status: 403, code: "player_inactive" }, status: 403 },
  { result: { ok: false, status: 500, code: "auth_not_configured" }, status: 500 },
];

for (const [name, call] of routes) {
  test(`${name}: every failed authentication result gets its own status, and no pool data is touched`, async () => {
    for (const failure of FAILURES) {
      result = failure.result;
      databaseCalls = 0;
      const response = await call();
      assert.equal(response.status, failure.status, `${name} ${failure.result.code}`);
      const body = await response.json();
      assert.equal(body.code, failure.result.code);
      assert.ok(body.error.length > 0);
      assert.equal(databaseCalls, 0);
    }
  });

  test(`${name}: a verified player gets past the gate to the route's own work`, async () => {
    result = { ok: true, player: { id: "c1", first_name: "Dana", active: true, is_commissioner: true } };
    databaseCalls = 0;
    // The fixture database throws, so reaching it (as a thrown error or a server error) proves the gate let the request in.
    const outcome = await call().then((response) => response.status, () => "threw");
    // (The profile read needs no database: the verified player row is the answer.)
    assert.ok(outcome === "threw" || outcome === 200 || (outcome >= 400 && outcome !== 401 && outcome !== 403), String(outcome));
  });
}

test("an ordinary player on a Commissioner route is a 403 with the Commissioner message; a sign-in outage is a 503, not that message", async () => {
  const players = await import("../src/app/api/admin/players/route.ts");
  result = { ok: false, status: 403, code: "commissioner_required" };
  const denied = await players.GET(get());
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error, "Commissioner access is required.");
  result = { ok: false, status: 503, code: "auth_unavailable" };
  const outage = await players.GET(get());
  assert.equal(outage.status, 503);
  assert.notEqual((await outage.json()).error, "Commissioner access is required.");
});

test("no route is left on the retired null-or-player helpers, and none tests the access object for truthiness", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map((entry) => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]))).flat();
  const files = (await walk(fileURLToPath(new URL("../src", import.meta.url)))).filter((file) => /\.(ts|tsx)$/.test(file));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /\brequireCommissioner\(request\)/, file);
    assert.doesNotMatch(source, /\bauthenticatedProfilePlayer\(/, file);
    assert.doesNotMatch(source, /if \(!\(await (commissionerAccess|profilePlayerAccess)\(/, file);
  }
});
