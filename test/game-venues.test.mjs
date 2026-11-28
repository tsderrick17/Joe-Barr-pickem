import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = {};", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { resolveGameVenues } = await import("../src/lib/game-venues.ts");

/** ESPN's game summary as it answers, by ESPN id; an id it does not know fails like an outage. */
const espn = (places) => {
  const asked = [];
  const fetcher = async (url) => {
    const id = new URL(url).searchParams.get("event");
    asked.push(id);
    if (!(id in places)) return new Response("down", { status: 503 });
    return Response.json({ gameInfo: { venue: { address: places[id] } } });
  };
  return { fetcher, asked };
};

test("a neutral-site game is placed from ESPN, so a city abroad not on the stadium list is still picked up and a wrong stadium is corrected", async () => {
  const { fetcher, asked } = espn({ e1: { city: "Dublin", country: "Ireland" }, e2: { city: "Santa Clara", state: "CA", country: "USA" }, e3: { city: "Berlin", country: "Germany" } });
  const games = [
    { providerEventId: "dublin", neutral: true, espnId: "e1", venue: null },                                         // Croke Park, the feed naming the home stadium
    { providerEventId: "super-bowl-site", neutral: true, espnId: "e2", venue: null },                                // neutral but at home: no pin
    { providerEventId: "berlin", neutral: true, espnId: "e3", venue: { city: "Pittsburgh?", country: "nowhere" } },  // ESPN wins over a wrong list match
    { providerEventId: "home", neutral: false, espnId: "e9", venue: null },                                          // an ordinary game: ESPN is never asked
  ];
  const { placed, unplaced } = await resolveGameVenues(games, new Map(), fetcher);
  assert.deepEqual(placed.get("dublin"), { city: "Dublin", country: "Ireland" });
  assert.equal(placed.get("super-bowl-site"), null);
  assert.deepEqual(placed.get("berlin"), { city: "Berlin", country: "Germany" });
  assert.equal(placed.get("home"), null);
  assert.deepEqual(asked, ["e1", "e2", "e3"]);
  assert.deepEqual(unplaced, []);
});

test("ESPN is asked only for a game with no place saved; when it cannot answer, the stadium list's place stands, and a game nothing can place is reported", async () => {
  const { fetcher, asked } = espn({});
  const games = [
    { providerEventId: "saved", neutral: true, espnId: "e1", venue: null },
    { providerEventId: "listed", neutral: true, espnId: "e2", venue: { city: "London", country: "England" } },
    { providerEventId: "unknown", neutral: true, espnId: "e3", venue: null },
  ];
  const { placed, unplaced } = await resolveGameVenues(games, new Map([["saved", { city: "Madrid", country: "Spain" }]]), fetcher);
  assert.deepEqual(placed.get("saved"), { city: "Madrid", country: "Spain" });
  assert.deepEqual(placed.get("listed"), { city: "London", country: "England" });
  assert.equal(placed.get("unknown"), null);
  assert.deepEqual(asked, ["e2", "e3"]);
  assert.deepEqual(unplaced, ["unknown"]);
});
