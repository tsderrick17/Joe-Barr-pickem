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
