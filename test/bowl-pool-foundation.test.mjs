import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { bowlPoolLaunchAt, compareBowlPoolStandings, gradeBowlPoolPick, normalizeBowlPoolSpread } from "../src/lib/bowl-pool.js";
import { bowlReceiptSummary } from "../src/lib/bowl-receipt.js";

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
  assert.match(page, /I would like to participate in the NCAA Bowl Pool \(you can opt out prior to first kickoff\)/);
  assert.match(page, /bowlReceiptSummary/);
  assert.match(page, /BOWL RECEIPT/);
  assert.match(page, /optedIn === true \? <section/);
  assert.match(page, /poolLocked \? optedIn === false/);
  assert.match(page, /Bowl Pool entry is closed for this year\. Check back next year\./);
  assert.match(page, /Select favorite team/);
  assert.match(page, /aria-label="Spread"/);
  assert.match(page, /Select underdog team/);
  assert.match(page, /bowl-team-label--new/);
  assert.match(page, /!gameLocked\(game\)/);
  assert.match(page, /type="button">SUBMIT<\/button>/);
  assert.doesNotMatch(page, /SUBMITTING…/);
  assert.doesNotMatch(page, /Separate competition|Preview|Stage the schedule|Standings card|Commissioner preview only/);
});

test("Bowl receipt distinguishes a draft, a saved partial card, and a complete saved card", () => {
  assert.deepEqual(bowlReceiptSummary({ selectedCount: 5, totalGames: 42, tiebreaker: "", hasUnsavedChanges: true }), {
    picksLabel: "5/42", tiebreakerLabel: "DUE", status: "CHANGED · SUBMIT TO SAVE", state: "unsaved",
  });
  assert.deepEqual(bowlReceiptSummary({ selectedCount: 42, totalGames: 42, tiebreaker: "" }), {
    picksLabel: "42/42", tiebreakerLabel: "DUE", status: "SAVED · TIEBREAKER DUE", state: "quiet",
  });
  assert.deepEqual(bowlReceiptSummary({ selectedCount: 42, totalGames: 42, tiebreaker: "54" }), {
    picksLabel: "42/42", tiebreakerLabel: "54", status: "COMPLETE · SAVED", state: "complete",
  });
});

test("Bowl entry locks opt-in at the first kickoff but still accepts later open-game selections", async () => {
  const route = await readFile(new URL("../src/app/api/bowl-pool/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/bowl-pool/page.tsx", import.meta.url), "utf8");
  assert.match(route, /const entryClosed = Boolean\(firstKickoff/);
  assert.match(route, /entryClosed && \(!existing \|\| existing\.status !== "active"\)/);
  assert.match(page, /const championshipLocked/);
  assert.match(page, /disabled=\{championshipLocked\}/);
  assert.match(page, /!gameLocked\(game\)/);
  assert.match(page, /disabled=\{gameLocked\(game\)\}/);
});
