import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { insertedRow, recordingDatabase, wrote } from "./helpers/recording-database.mjs";

// The real scheduling step, with its database scripted: an existing recap record, in any form, makes it a no-op.
const PERIOD = { id: "period-5", season_id: "season-1", display_name: "Week 5", settled_at: "2026-10-12T04:00:00Z" };
let existing = null;
let insertError = null;
let database;
const respond = (table, calls) => {
  const isInsert = calls.some(([name]) => name === "insert");
  if (table === "players") return { data: { id: "commissioner-1" }, error: null };
  if (table === "reminder_templates" || table === "survivor_entries") return { data: [], error: null };
  if (table === "seasons") return { data: { survivor_champion_player_id: null }, error: null };
  if (table === "push_reminders" && isInsert) return insertError ? { data: null, error: insertError } : { data: { id: "reminder-1" }, error: null };
  if (table === "push_reminders") return { data: existing, error: null };
  throw new Error(`unexpected table ${table}`);
};
globalThis.recapFixture = { supabaseAdmin: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.recapFixture.supabaseAdmin[name](...args) });", shortCircuit: true };
    if (specifier === "@/lib/weekly-recap-period") return { url: `data:text/javascript,export const findLatestSettledWeeklyRecapPeriod = async () => (${JSON.stringify(PERIOD)});`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { ensureAutomaticWeeklyRecap } = await import("../src/lib/automatic-weekly-recap.ts");
const NOW = new Date("2026-10-13T12:00:00Z"); // the Tuesday after the week settled
const setup = ({ existingRecord = null, error = null } = {}) => { existing = existingRecord; insertError = error; database = recordingDatabase(respond); globalThis.recapFixture.supabaseAdmin = database; };
const recapQueries = () => database.queries.filter((query) => query.table === "push_reminders");

test("any existing recap record for the week makes the step a no-op that writes nothing", async () => {
  setup({ existingRecord: { id: "manual-recap-from-earlier" } });
  assert.deepEqual(await ensureAutomaticWeeklyRecap(NOW), { created: false, reason: "already_queued" });
  assert.ok(!recapQueries().some((query) => wrote(query.calls)), "nothing is inserted");
  const lookup = recapQueries()[0].calls;
  assert.deepEqual(lookup.filter(([name]) => name === "eq").map(([, args]) => args), [["category", "weekly_recap"], ["source_scoring_period_id", "period-5"]], "it looks for any recap of this week, not one by key");
  assert.ok(lookup.some(([name, args]) => name === "limit" && args[0] === 1), "one record is enough");
});

test("with none yet, the recap is queued once, keyed to the week", async () => {
  setup();
  assert.deepEqual(await ensureAutomaticWeeklyRecap(NOW), { created: true, reason: null });
  const inserts = recapQueries().filter((query) => wrote(query.calls));
  assert.equal(inserts.length, 1);
  const row = insertedRow(inserts[0].calls);
  assert.equal(row.automation_key, "plan:period-5:weekly_recap");
  assert.equal(row.category, "weekly_recap");
  assert.equal(row.source_scoring_period_id, "period-5");
  assert.equal(row.created_by_player_id, "commissioner-1");
});

test("losing a race to another run (unique violation) is the same safe no-op, not an error", async () => {
  setup({ error: { code: "23505", message: "duplicate key" } });
  assert.deepEqual(await ensureAutomaticWeeklyRecap(NOW), { created: false, reason: "already_queued" });
});

test("a real database error while queuing is raised, never swallowed", async () => {
  setup({ error: { code: "XX000", message: "boom" } });
  await assert.rejects(ensureAutomaticWeeklyRecap(NOW), /could not be queued/);
});
