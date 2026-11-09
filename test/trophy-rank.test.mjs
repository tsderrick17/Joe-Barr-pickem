import assert from "node:assert/strict";
import test from "node:test";
import { placesFor } from "../src/lib/trophy-rank.js";

const row = (h, ab, qualified = true) => ({ h, avg: ab ? h / ab : null, qualified });

test("players level on hit rate share a place and the next player skips the places they took", () => {
  const rows = [row(8, 12), row(4, 6), row(7, 11), row(7, 12), row(6, 12), row(6, 12), row(6, 12)];
  assert.deepEqual(placesFor(rows, "rate").map((p) => p.place), [1, 1, 3, 4, 5, 5, 5]);
  assert.deepEqual(placesFor(rows, "rate").map((p) => p.tied), [true, true, false, false, true, true, true]);
});

test("under wins, players with the same number of wins are tied whatever their hit rates", () => {
  const rows = [row(8, 12), row(8, 13), row(7, 11), row(7, 12), row(4, 12)];
  assert.deepEqual(placesFor(rows, "wins").map((p) => p.place), [1, 1, 3, 3, 5]);
});

test("players below the picks threshold are not tied with those above it, and have no place problems when nobody is level", () => {
  const rows = [row(5, 10), row(5, 10, false)];
  assert.deepEqual(placesFor(rows, "rate").map((p) => p.place), [1, 2]);
  assert.deepEqual(placesFor([], "rate"), []);
});

test("the half-point hit rate is wins over games decided that way, and nothing when none were", async () => {
  const { halfRate, sortValue } = await import("../src/lib/trophy-rank.js");
  assert.equal(halfRate({ halfWins: 6, halfLosses: 4 }), 0.6);
  assert.equal(halfRate({ halfWins: 0, halfLosses: 0 }), null);
  assert.equal(halfRate({}), null);
  assert.equal(sortValue({ halfWins: 3, halfLosses: 1 }, "halfRate"), 0.75);
  assert.equal(sortValue({}, "halfRate"), 0, "no games sorts last");
});

test("sorted by half-point hit rate, players with no game decided that way go last either way, and level rates go to more wins", async () => {
  const { compareRows, placesFor } = await import("../src/lib/trophy-rank.js");
  const player = (name, halfWins, halfLosses) => ({ name, halfWins, halfLosses });
  // The table on 2026-11-09: John and Shane O are 0-1, Rick, Steve and Tyler have none; Zac 2-0 and Shane D 1-0.
  const rows = [player("Al", 1, 1), player("John", 0, 1), player("Rick", 0, 0), player("Shane D", 1, 0), player("Shane O", 0, 1), player("Steve", 0, 0), player("Tyler", 0, 0), player("Zac", 2, 0)];
  const order = (descending) => [...rows].sort((a, b) => compareRows(a, b, "halfRate", descending)).map((row) => row.name);
  assert.deepEqual(order(true), ["Zac", "Shane D", "Al", "John", "Shane O", "Rick", "Steve", "Tyler"]);
  assert.deepEqual(order(false), ["John", "Shane O", "Al", "Shane D", "Zac", "Rick", "Steve", "Tyler"]);
  const sorted = [...rows].sort((a, b) => compareRows(a, b, "halfRate", true));
  assert.deepEqual(placesFor(sorted, "halfRate").map((p) => p.place), [1, 1, 3, 4, 4, 6, 6, 6], "0-1 is not level with no games");
});

test("the other columns keep their order: hit rate ranks qualified players first, names go A to Z, and wins break ties on hit rate", async () => {
  const { compareRows } = await import("../src/lib/trophy-rank.js");
  const a = { name: "Al", h: 5, avg: 0.5, qualified: true }, b = { name: "Bo", h: 2, avg: 1, qualified: false }, c = { name: "Cy", h: 5, avg: 0.6, qualified: true };
  const order = (key, descending) => [a, b, c].sort((x, y) => compareRows(x, y, key, descending)).map((row) => row.name);
  assert.deepEqual(order("rate", true), ["Cy", "Al", "Bo"]);
  assert.deepEqual(order("name", false), ["Al", "Bo", "Cy"]);
  assert.deepEqual(order("wins", true), ["Cy", "Al", "Bo"]);
});
