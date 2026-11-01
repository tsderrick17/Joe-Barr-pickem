import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The Bowl Pool page's data: when a read the standings or the player's own picks depend on fails, the answer is an error the page can retry, never a page
// that quietly shows everyone with no picks or every row as "Player".
const SEASON = { id: "s1", season_year: 2026, player_visible_at: "2026-12-07T08:00:00Z", first_kickoff_at: "2026-12-19T18:00:00Z", championship_game_id: null };
const GAME = { id: "g1", provider_game_id: "espn:1", bowl_name: "Frisco Bowl", kickoff_at: "2026-12-19T18:00:00Z", line_lock_at: "2026-12-19T13:00:00Z", order_index: 1, status: "scheduled", is_cfp: false, away_team_id: "t1", home_team_id: "t2", away_score: null, home_score: null, venue_city: null, venue_state: null, time_confirmed: true };
const TEAM = (id) => ({ id, display_name: `Team ${id}`, short_name: id, abbreviation: id, primary_color: null, secondary_color: null });
const TABLES = {
  bowl_pool_seasons: SEASON,
  bowl_pool_games: [GAME],
  bowl_pool_teams: [TEAM("t1"), TEAM("t2")],
  bowl_pool_entries: (single) => (single ? { id: "e1", status: "active", championship_total_guess: 50, opted_in_at: "2026-12-08T00:00:00Z", opted_out_at: null, preview_selections: [] } : [{ id: "e1", player_id: "p1", status: "active", championship_total_guess: 50 }]),
  bowl_pool_picks: [], bowl_pool_game_lines: [], bowl_pool_game_results: [],
  players: [{ id: "p1", first_name: "Ann" }], pool_championships: [], bowl_pool_championships: [],
};
let failing = null;
const respond = (table, calls) => {
  if (table === failing) return { data: null, error: { code: "XX000", message: "database unreachable" } };
  const value = TABLES[table];
  if (value === undefined) throw new Error(`unexpected table ${table}`);
  return { data: typeof value === "function" ? value(calls.some(([name]) => name === "maybeSingle")) : value, error: null };
};
globalThis.bowlRouteFixture = { database: recordingDatabase(respond) };
registerHooks({
  resolve(specifier, context, nextResolve) {
    const shim = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
    if (specifier === "@/lib/supabase-admin") return shim("export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlRouteFixture.database[name](...args) });");
    if (specifier === "@/lib/authenticate-active-player") return shim("export const authenticateActivePlayer = async () => ({ ok: true, player: { id: 'p1', first_name: 'Ann', is_commissioner: false } });");
    if (specifier === "next/server") return { url: new URL("./helpers/next-server-stub.mjs", import.meta.url).href, shortCircuit: true };
    if (specifier === "server-only") return shim("export {};");
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { GET } = await import("../src/app/api/bowl-pool/route.ts");

async function load(failingTable = null) {
  failing = failingTable;
  bowlRouteFixture.database = recordingDatabase(respond);
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-10T12:00:00Z") });
  const realError = console.error;
  console.error = () => undefined;
  try {
    const response = await GET(new Request("http://localhost/api/bowl-pool", { headers: { authorization: "Bearer fixture" } }));
    return { status: response.status, body: await response.json() };
  } finally { console.error = realError; mock.timers.reset(); }
}

test("with every read answering, the page has its standings with the players' names", async () => {
  const { status, body } = await load();
  assert.equal(status, 200);
  assert.deepEqual(body.standings.map((row) => row.playerName), ["Ann"]);
});

test("a failed read of entries, picks, results or lines is an error to retry, not an empty page", async () => {
  for (const table of ["bowl_pool_entries", "bowl_pool_picks", "bowl_pool_game_results", "bowl_pool_game_lines", "bowl_pool_teams"]) {
    const { status, body } = await load(table);
    assert.equal(status, 503, table);
    assert.match(body.error, /could not be loaded right now/, table);
    assert.equal(body.standings, undefined, `${table}: no partial standings`);
  }
});

test("a failed read of the players' names is an error, not a standings list of \"Player\"", async () => {
  const { status, body } = await load("players");
  assert.equal(status, 503);
  assert.equal(body.standings, undefined);
});
