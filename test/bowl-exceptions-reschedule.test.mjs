import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The Commissioner's Reschedule for a postponed Bowl game, run through the real route with its database scripted: the game moves in the
// database (its picks stay), and the reminders queued for the old time are cancelled AND let go of their keys, so the sweep that queues
// reminders can queue fresh ones for the new time. A cancelled reminder that kept its key would block that for good.
let rescheduleError = null;
let remindersError = null;
let database;
const respond = (table) => (table === "push_reminders" && remindersError ? { data: null, error: remindersError } : { data: null, error: null });
const start = () => {
  database = recordingDatabase(respond, { rpc: () => ({ data: null, error: rescheduleError }) });
  globalThis.bowlExceptionsFixture.database = database;
};
globalThis.bowlExceptionsFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/require-commissioner") return { url: "data:text/javascript,export const commissionerAccess = async () => ({ ok: true, player: { id: 'commissioner-1' } });", shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlExceptionsFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { NextRequest } = await import("next/server.js");
const { POST } = await import("../src/app/api/admin/bowl-pool/exceptions/route.ts");
const reschedule = async (body = { gameId: "game-1", status: "rescheduled", kickoffAt: "2026-12-30T00:00:00Z" }) => {
  start();
  const response = await POST(new NextRequest("http://localhost/api/admin/bowl-pool/exceptions", { method: "POST", body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() };
};
const cancellation = () => database.queries.find((query) => query.table === "push_reminders");
const called = (query, name) => query.calls.find(([method]) => method === name)?.[1];

test("rescheduling a postponed game moves it in the database, then cancels its queued reminders and releases their keys", async () => {
  rescheduleError = null; remindersError = null;
  const result = await reschedule();
  assert.equal(result.status, 200);
  assert.deepEqual(database.rpcCalls, [{ name: "reschedule_bowl_game", args: { target_game_id: "game-1", new_kickoff_at: "2026-12-30T00:00:00.000Z", actor_player_id: "commissioner-1" } }]);
  const update = called(cancellation(), "update")[0];
  assert.equal(update.status, "cancelled");
  assert.equal(update.automation_key, null, "the key is released so a fresh reminder can be queued for the new time");
  assert.deepEqual(called(cancellation(), "in")[1], ["bowl_pick_due", "bowl_line_lock", "bowl_daily_recap"]);
  assert.deepEqual(called(cancellation(), "contains"), ["source_game_ids", ["game-1"]]);
});

test("when the database refuses the reschedule, no reminder is touched", async () => {
  rescheduleError = { message: "Only postponed Bowl games can be rescheduled." }; remindersError = null;
  const result = await reschedule();
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Only postponed Bowl games can be rescheduled.");
  assert.equal(cancellation(), undefined);
});

test("if the old reminders cannot be cleared the Commissioner is told, not given a success", async () => {
  rescheduleError = null; remindersError = { message: "down" };
  const result = await reschedule();
  assert.equal(result.status, 500);
  assert.match(result.body.error, /rescheduled and its picks kept/);
});
