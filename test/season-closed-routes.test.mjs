import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase, wrote } from "./helpers/recording-database.mjs";

let phase = "off_season";
let writes = 0;
let reads = 0;
globalThis.seasonClosedDatabase = {
  from() { reads += 1; throw new Error("A refused save must not read or write pool data."); },
  rpc(name) {
    if (name === "season_phase") return Promise.resolve({ data: phase, error: null });
    writes += 1;
    return Promise.resolve({ data: null, error: { message: `unexpected ${name}` } });
  },
};
const player = { id: "p1", first_name: "Dana", is_commissioner: false, active: true, notification_email: null };
globalThis.seasonClosedAccess = async () => ({ ok: true, player });
globalThis.seasonClosedPerson = player;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.seasonClosedDatabase;", shortCircuit: true };
    if (specifier === "@/lib/authenticate-active-player") return { url: "data:text/javascript,export const authenticateActivePlayer = globalThis.seasonClosedAccess;", shortCircuit: true };
    if (specifier === "@/lib/authenticated-profile-player") return { url: "data:text/javascript,export const profilePlayerAccess = async () => ({ ok: true, player: globalThis.seasonClosedPerson });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";

const post = (url, body) => new Request(`http://localhost${url}`, { method: "POST", headers: { authorization: "Bearer fixture", "content-type": "application/json" }, body: JSON.stringify(body) });
const put = (url, body) => new Request(`http://localhost${url}`, { method: "PUT", headers: { authorization: "Bearer fixture", "content-type": "application/json" }, body: JSON.stringify(body) });

test("pick and Bowl saves are refused in the off-season with 409 and no read or write", async () => {
  const picks = await import("../src/app/api/picks/route.ts");
  const bowl = await import("../src/app/api/bowl-pool/route.ts");
  phase = "off_season"; reads = 0; writes = 0;
  const pickResponse = await picks.POST(post("/api/picks", { scoringPeriodId: "week-3", selections: [] }));
  assert.equal(pickResponse.status, 409);
  assert.equal((await pickResponse.json()).code, "season_closed");
  const bowlResponse = await bowl.POST(post("/api/bowl-pool", { selections: [] }));
  assert.equal(bowlResponse.status, 409);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test("a display choice is refused in the off-season, but notification settings still save", async () => {
  const profile = await import("../src/app/api/profile/route.ts");
  phase = "off_season"; reads = 0;
  for (const field of ["showSurvivorStandings", "showBowlCard", "hidePickemEliminatedRows", "hideSurvivorEliminatedRows"]) {
    const response = await profile.PUT(put("/api/profile", { [field]: true }));
    assert.equal(response.status, 409, field);
  }
  assert.equal(reads, 0, "a refused display choice reads nothing");
  // The Pool Action filter and Pool Chat are not display locks, so they get past the season check and on to the save.
  for (const body of [{ showPoolAction: true }, { showPoolChat: false }, { notificationEmail: "dana@example.com" }]) {
    reads = 0;
    const response = await profile.PUT(put("/api/profile", body)).catch(() => null);
    assert.notEqual(response?.status, 409, JSON.stringify(body));
  }
});

test("in season the same saves are not refused for the season", async () => {
  const picks = await import("../src/app/api/picks/route.ts");
  phase = "in_season";
  // The fixture database throws on any read, so a rejected promise means the save went on past the season check.
  await assert.rejects(() => picks.POST(post("/api/picks", { scoringPeriodId: "week-3", selections: [] })), /must not read or write/);
});

test("the Survivor save is refused in the off-season before its body is read or any pick is written; in season the same request goes on to the body", async () => {
  const survivor = await import("../src/app/api/survivor/route.ts");
  const database = globalThis.seasonClosedDatabase;
  const { from, rpc } = database;
  const rows = {
    seasons: { id: "season-1", survivor_champion_player_id: null },
    scoring_periods: [{ id: "week-3", display_name: "Week 3", display_order: 3, status: "active" }],
    survivor_entries: { id: "entry-1", status: "active", eliminated_at: null },
  };
  const written = [];
  const recorded = recordingDatabase((table, calls) => {
    if (wrote(calls)) written.push(table);
    return { data: rows[table] ?? null, error: null };
  }, { rpc: (name) => ({ data: name === "season_phase" ? phase : null, error: null }) });
  database.from = recorded.from;
  database.rpc = recorded.rpc;
  const notJson = () => new Request("http://localhost/api/survivor", { method: "POST", headers: { authorization: "Bearer fixture", "content-type": "application/json" }, body: "this is not json" });
  try {
    phase = "off_season";
    const closed = await survivor.POST(notJson());
    assert.equal(closed.status, 409, "refused for the season, not for the bad body");
    assert.equal((await closed.json()).code, "season_closed");
    assert.deepEqual(recorded.rpcCalls.map((call) => call.name).filter((name) => !["season_phase", "ensure_survivor_entries"].includes(name)), [], "no submit call");
    assert.deepEqual(written.filter((table) => table === "picks" || table === "survivor_picks"), [], "no pick written");
    phase = "in_season";
    const open = await survivor.POST(notJson());
    assert.equal(open.status, 400, "in season the request gets as far as its body");
  } finally {
    database.from = from;
    database.rpc = rpc;
  }
});
