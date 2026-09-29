import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compareBowlPoolStandings } from "../src/lib/bowl-pool.js";

test("a missing tiebreaker guess loses the tiebreaker but never outranks more wins", () => {
  const rows = [
    { playerName: "Al", wins: 5, tiebreakerTotal: null },
    { playerName: "Bo", wins: 5, tiebreakerTotal: 80 },
    { playerName: "Cy", wins: 5, tiebreakerTotal: 51 },
    { playerName: "Di", wins: 6, tiebreakerTotal: null },
  ];
  assert.deepEqual([...rows].sort((a, b) => compareBowlPoolStandings(a, b, 50)).map((row) => row.playerName), ["Di", "Cy", "Bo", "Al"]);
});

test("the database champion includes entries without a guess and shares the title when no leader guessed", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260929050000_bowl_champion_missing_tiebreaker.sql", import.meta.url), "utf8");
  assert.match(sql, /alter column championship_total_guess drop not null/);
  assert.match(sql, /alter column final_total_difference drop not null/);
  assert.doesNotMatch(sql, /and entry\.championship_total_guess is not null/);
  assert.match(sql, /or \(select min\(difference\) from leaders\) is null/);
  assert.match(sql, /grant execute on function public\.refresh_bowl_pool_champion\(uuid, timestamptz\) to service_role;/);
  const route = await readFile(new URL("../src/app/api/bowl-pool/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(aGuess !== null && bGuess === null\) return -1;/);
});
