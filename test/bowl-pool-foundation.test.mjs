import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { bowlPoolLaunchAt, compareBowlPoolStandings, gradeBowlPoolPick, normalizeBowlPoolSpread } from "../src/lib/bowl-pool.js";

test("bowl pool preserves PK but removes whole-number ATS pushes", () => {
  assert.equal(normalizeBowlPoolSpread(0), 0);
  assert.equal(normalizeBowlPoolSpread(3), 3.5);
  assert.equal(normalizeBowlPoolSpread(3.5), 3.5);
  assert.equal(gradeBowlPoolPick({ selectedTeamId: "away", favoriteTeamId: "away", lockedSpread: 3.5, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 21 }), "loss");
  assert.equal(gradeBowlPoolPick({ selectedTeamId: "away", favoriteTeamId: null, lockedSpread: 0, awayTeamId: "away", homeTeamId: "home", awayScore: 24, homeScore: 21 }), "win");
});

test("bowl-pool standings use the closest CFP-final total after wins", () => {
  const rows = [
    { playerName: "Al", wins: 20, tiebreakerTotal: 51 },
    { playerName: "Joe", wins: 20, tiebreakerTotal: 48 },
    { playerName: "Tyler", wins: 19, tiebreakerTotal: 54 },
  ];
  assert.deepEqual([...rows].sort((a, b) => compareBowlPoolStandings(a, b, 50)).map((row) => row.playerName), ["Al", "Joe", "Tyler"]);
  assert.equal(bowlPoolLaunchAt(2026), "2026-12-07T08:00:00.000Z");
});

test("bowl-pool migration keeps voluntary entry, per-kickoff privacy, and draft-purge safeguards separate from NFL", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260907010000_add_bowl_pool_foundation.sql", import.meta.url), "utf8");
  for (const table of ["bowl_pool_seasons", "bowl_pool_entries", "bowl_pool_games", "bowl_pool_game_lines", "bowl_pool_picks", "bowl_pool_championships"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`, "i"));
  }
  assert.match(migration, /normalize_bowl_pool_spread/i);
  assert.match(migration, /validate_bowl_pool_pick/i);
  assert.match(migration, /clock_timestamp\(\) >= game_row\.kickoff_at/i);
  assert.match(migration, /purge_withdrawn_bowl_pool_drafts/i);
  assert.match(migration, /revoke all on table public\.bowl_pool_seasons/i);
});

test("Bowl Pool opt-in controls the whole selection card", async () => {
  const page = await readFile(new URL("../src/app/bowl-pool/page.tsx", import.meta.url), "utf8");
  assert.match(page, /I would like to participate in the NCAA Bowl Pool \(you can opt out at any time\)/);
  assert.match(page, /optedIn \? <section/);
  assert.match(page, /Select favorite team/);
  assert.match(page, /Blank spread/);
  assert.match(page, /Select underdog team/);
  assert.doesNotMatch(page, /Separate competition|Preview|Stage the schedule|Standings card|Commissioner preview only/);
});
