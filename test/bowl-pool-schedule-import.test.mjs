import test from "node:test";
import assert from "node:assert/strict";
import { parseBowlPoolScheduleCsv, normalizeBowlDisplayName } from "../src/lib/bowl-pool-schedule.js";

test("schedule importer preserves canonical names and allows blank teams", () => {
  const rows = parseBowlPoolScheduleCsv("order,bowl_name,kickoff_at,game_key,away_team,home_team,spread\n2, Pop-Tarts Bowl,2026-12-28T20:00:00-05:00,bowl-2,,,\n1, Rose Bowl,2026-12-26T17:00:00-05:00,bowl-1,,,");
  assert.deepEqual(rows.map((row) => row.order_index), [1, 2]);
  assert.equal(rows[0].bowl_name, "Rose Bowl");
  assert.equal(rows[0].away_team, null);
});

test("schedule importer rejects duplicate keys and malformed dates", () => {
  assert.throws(() => parseBowlPoolScheduleCsv("order,bowl_name,kickoff_at,game_key\n1,Rose Bowl,nope,x\n1,Peach Bowl,2026-12-30T00:00:00Z,x"), /invalid kickoff_at|Duplicate game_key/);
  assert.equal(normalizeBowlDisplayName("  Rose   Bowl "), "Rose Bowl");
});
