import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("the Survivor save asks the season question before it touches a pick", async () => {
  const source = await readFile(new URL("../src/app/api/survivor/route.ts", import.meta.url), "utf8");
  const post = source.slice(source.indexOf("export async function POST"));
  const closed = post.indexOf("refuseWhenSeasonClosed()");
  assert.ok(closed > 0, "the Survivor POST refuses a closed season");
  assert.ok(closed < post.indexOf("readJsonObject(request)"), "before the body is read");
  assert.ok(closed < post.indexOf('.rpc('), "and before any write");
});

test("the player pages treat a missing season phase as in season, and lock the display only in the off-season", async () => {
  const standings = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const slate = await readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8");
  assert.match(standings, /const offSeason = data\.seasonPhase === "off_season";/);
  assert.match(standings, /showSurvivorStandings: true, hidePickemEliminatedRows: false, hideSurvivorEliminatedRows: false, showBowlCard: true/);
  assert.match(standings, /onToggleEliminatedRows=\{offSeason \? undefined :/);
  assert.match(standings, /displayLocked=\{offSeason\}/);
  const slateState = await readFile(new URL("../src/lib/slate-state.ts", import.meta.url), "utf8");
  assert.match(slateState, /seasonOver: data\.seasonPhase \? data\.seasonPhase === "off_season" : state\.seasonOver/);
  assert.match(slate, /const isReadOnly = week\?\.status === "complete" \|\| playoffEliminated \|\| seasonOver;/);
  assert.match(slate, /const seasonClosedForViewer = seasonOver \|\| playoffEliminated;/);
  assert.match(slate, /\{seasonClosedForViewer \? null : <SlateReceipt/);
  // The ticket and the receipt are gone, for the off-season and for a player out of the playoff race.
  assert.match(standings, /const seasonClosedForViewer = offSeason \|\| viewerEliminated;/);
  assert.match(standings, /\{seasonClosedForViewer \? <SeasonClosedBanner eliminated=\{!offSeason\} \/> : <MyTicket/);
});
