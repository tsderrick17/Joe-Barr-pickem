import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { SEASON_PHASE_SCENARIOS, atYear } from "./helpers/season-phase-scenarios.mjs";

const rpcCalls = [];
let phaseAnswer = { data: "off_season", error: null };
let bowlAnswer = { data: false, error: null };
globalThis.seasonPhaseDatabase = {
  from() { throw new Error("An idle worker must not read or write pool data."); },
  rpc(name) {
    rpcCalls.push(name);
    if (name === "season_phase") return Promise.resolve(phaseAnswer);
    if (name === "bowl_window_open") return Promise.resolve(bowlAnswer);
    return Promise.resolve({ data: null, error: { message: `unexpected ${name}` } });
  },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.seasonPhaseDatabase;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.CRON_SECRET = "fixture-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { seasonPhaseAt, bowlWindowOpenAt } = await import("../src/lib/season-phase.ts");

// A fictional season year: the rules do not depend on which one.
const YEAR = 4321;

test("the season phase and Bowl window follow the shared scenarios, from the Super Bowl to August 1", () => {
  for (const scenario of SEASON_PHASE_SCENARIOS) {
    const at = new Date(atYear(scenario.at, YEAR));
    const periods = scenario.season ?? scenario.nextSeason;
    const done = periods && periods.regular === "complete" && periods.superBowl === "complete";
    // The row only counts when it is the one for the season year of that moment.
    const facts = scenario.season ? { state: done ? "complete" : "playoffs", superBowlStatus: periods.superBowl } : null;
    const phase = seasonPhaseAt(facts);
    assert.equal(phase, scenario.phase, scenario.name);
    assert.equal(bowlWindowOpenAt({ at, phase, bowlComplete: scenario.bowlComplete }), scenario.bowlOpen, `${scenario.name} (Bowl window)`);
  }
});

test("a completed season whose Super Bowl is not complete stays in season", () => {
  assert.equal(seasonPhaseAt({ state: "complete", superBowlStatus: "active" }), "in_season");
  assert.equal(seasonPhaseAt({ state: "complete", superBowlStatus: null }), "in_season");
  assert.equal(seasonPhaseAt(null), "in_season");
});

const routes = {
  "sync-scores": ["../src/app/api/cron/sync-scores/route.ts", "season"],
  "lock-lines": ["../src/app/api/cron/lock-lines/route.ts", "season"],
  "send-reminders": ["../src/app/api/cron/send-reminders/route.ts", "season"],
  "maintain-reminders": ["../src/app/api/cron/maintain-reminders/route.ts", "season"],
  "sync-bowl-scores": ["../src/app/api/cron/sync-bowl-scores/route.ts", "bowl"],
};
const authorized = () => new Request("http://localhost/api/cron/x", { method: "POST", headers: { authorization: "Bearer fixture-secret" } });

for (const [name, [path, window]] of Object.entries(routes)) {
  test(`${name} answers at once outside its window, with no lease, provider call or write`, async () => {
    const { POST } = await import(path);
    rpcCalls.length = 0;
    phaseAnswer = { data: "off_season", error: null };
    bowlAnswer = { data: false, error: null };
    const response = await POST(authorized());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.skipped, true);
    assert.equal(body.success, true);
    assert.deepEqual(rpcCalls, [window === "bowl" ? "bowl_window_open" : "season_phase"], "only the phase question is asked");
  });

  test(`${name} still rejects a bad secret before asking anything`, async () => {
    const { POST } = await import(path);
    rpcCalls.length = 0;
    const response = await POST(new Request("http://localhost/api/cron/x", { method: "POST", headers: { authorization: "Bearer nope" } }));
    assert.equal(response.status, 401);
    assert.deepEqual(rpcCalls, []);
  });

  test(`${name} goes on to its lease inside its window, and when the phase cannot be read`, async () => {
    const { POST } = await import(path);
    for (const answers of [
      { phase: { data: "in_season", error: null }, bowl: { data: true, error: null } },
      { phase: { data: null, error: { message: "down" } }, bowl: { data: null, error: { message: "down" } } },
    ]) {
      rpcCalls.length = 0;
      phaseAnswer = answers.phase;
      bowlAnswer = answers.bowl;
      const response = await POST(authorized());
      // The fixture database has no lease function, so reaching it proves the worker was not skipped.
      assert.equal((await response.json()).skipped, undefined);
      assert.ok(rpcCalls.length > 1, "the worker went on to claim its lease");
    }
  });
}

test("every dispatcher and every direct cron job is gated in the database, so idle off-season ticks never call Vercel", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("../supabase/migrations/20261007010000_season_phase.sql", import.meta.url), "utf8");
  const body = (name) => sql.slice(sql.indexOf(`function public.${name}()`), sql.indexOf("$$;", sql.indexOf(`function public.${name}()`)));
  assert.match(body("dispatch_line_lock_if_due"), /season_phase\(\) = 'off_season' then return false/);
  assert.match(body("dispatch_reminders_if_due"), /season_phase\(\) = 'off_season' then return false/);
  assert.match(body("dispatch_bowl_sync_if_due"), /not public\.bowl_window_open\(evaluated_at\) then return false/);
  // The four jobs that call Vercel straight from pg_cron carry the gate and keep the names the preflight checks.
  assert.match(sql, /where public\.season_phase\(\) = ''in_season''/);
  for (const job of ["refresh-final-nfl-scores-every-ten-minutes", "refresh-nfl-schedule-and-spreads-prelock-early", "refresh-nfl-schedule-and-spreads-prelock-standard", "reconcile-pickem-email-schedule-every-fifteen-minutes"]) {
    assert.ok(sql.includes(`'${job}'`), job);
  }
  // The preseason bootstrap (which performs the August 1 rollover) and the watchdog are deliberately not gated.
  assert.doesNotMatch(sql, /bootstrap-season|cron\/watchdog/);
});
