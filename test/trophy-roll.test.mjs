import test from "node:test";
import assert from "node:assert/strict";
import { championRoll } from "../src/lib/trophy-roll.js";

const person = (playerId, name) => ({ playerId, name });
const seasons = [
  { seasonYear: 2025, pickem: [person("steve", "Steve")], survivor: [person("john", "John")], bowl: [person("al", "Al")] },
  { seasonYear: 2027, pickem: [person("rick", "Rick"), person("gary", "Gary")], survivor: null, bowl: [] },
  { seasonYear: 2026, pickem: [person("steve", "Steve")], survivor: [person("zac", "Zac")], bowl: null },
  { seasonYear: 2028, pickem: [person("steve", "Steve")], survivor: [person("zac", "Zac")], bowl: [person("al", "Al")] },
];

test("one banner per person, carrying every year they won, oldest first", () => {
  assert.deepEqual(championRoll(seasons, "pickem").find((banner) => banner.name === "Steve"), { playerId: "steve", name: "Steve", years: [2025, 2026, 2028] });
  assert.deepEqual(championRoll(seasons, "survivor"), [
    { playerId: "john", name: "John", years: [2025] }, { playerId: "zac", name: "Zac", years: [2026, 2028] },
  ]);
  assert.deepEqual(championRoll(seasons, "bowl"), [{ playerId: "al", name: "Al", years: [2025, 2028] }]);
});

test("banners hang in the order they were first earned, so a new winner's banner is added after the others and a repeat winner's is not moved", () => {
  assert.deepEqual(championRoll(seasons, "pickem").map((banner) => banner.name), ["Steve", "Gary", "Rick"]);
  // Zac won in 2028 again but his banner stays where it was first hung, after John's.
  assert.deepEqual(championRoll(seasons, "survivor").map((banner) => banner.name), ["John", "Zac"]);
});

test("co-champions of one season each get their own banner, ordered by name", () => {
  const roll = championRoll(seasons, "pickem");
  assert.deepEqual(roll.slice(1).map((banner) => [banner.name, banner.years]), [["Gary", [2027]], ["Rick", [2027]]]);
});

test("seasons with no champion are left out, a person's name is the latest on record, and the input is not reordered", () => {
  assert.deepEqual(championRoll([{ seasonYear: 2025, pickem: null }, { seasonYear: 2026, pickem: [] }], "pickem"), []);
  const renamed = championRoll([{ seasonYear: 2025, pickem: [person("p", "Bob")] }, { seasonYear: 2026, pickem: [person("p", "Robert")] }], "pickem");
  assert.deepEqual(renamed, [{ playerId: "p", name: "Robert", years: [2025, 2026] }]);
  assert.deepEqual(seasons.map((season) => season.seasonYear), [2025, 2027, 2026, 2028]);
});

test("champions without a player id are told apart by name", () => {
  const roll = championRoll([{ seasonYear: 2025, pickem: [{ name: "Al" }] }, { seasonYear: 2026, pickem: [{ name: "Al" }, { name: "Bo" }] }], "pickem");
  assert.deepEqual(roll.map((banner) => [banner.name, banner.years]), [["Al", [2025, 2026]], ["Bo", [2026]]]);
});
