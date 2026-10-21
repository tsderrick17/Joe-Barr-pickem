import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { crownedInRecapWeek, recapSurvivorStatus } from "../src/lib/survivor-recap-status.js";

test("a crowned champion is never OUT in the recap, whatever their entry says", () => {
  assert.equal(recapSurvivorStatus({ entryStatus: "eliminated", isChampion: true }), "IN");
  assert.equal(recapSurvivorStatus({ entryStatus: "active", isChampion: true }), "IN");
  assert.equal(recapSurvivorStatus({ entryStatus: "eliminated", isChampion: false }), "OUT");
  assert.equal(recapSurvivorStatus({ entryStatus: undefined, isChampion: false }), "IN");
});

test("the champion counts as crowned in the recap week only when the crowning falls in that week", () => {
  const week = { firstKickoffAt: "2026-10-11T17:00:00Z", lastKickoffAt: "2026-10-13T01:00:00Z" };
  assert.equal(crownedInRecapWeek({ crownedAt: "2026-10-12T20:00:00Z", ...week }), true, "crowned during the week");
  assert.equal(crownedInRecapWeek({ crownedAt: "2026-10-13T20:00:00Z", ...week }), true, "crowned the evening after the last game");
  assert.equal(crownedInRecapWeek({ crownedAt: "2026-10-05T20:00:00Z", ...week }), false, "crowned the week before: a later recap must not say it again");
  assert.equal(crownedInRecapWeek({ crownedAt: null, ...week }), false);
  assert.equal(crownedInRecapWeek({ crownedAt: "2026-10-12T20:00:00Z", firstKickoffAt: undefined, lastKickoffAt: undefined }), false);
});

test("the no-pick rule leaves a season alone once its Survivor champion is crowned", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261021020000_survivor_champion_not_eliminated.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.eliminate_survivor_no_picks/i);
  assert.match(sql, /season\.survivor_champion_player_id is not null/i);
  assert.match(sql, /season\.survivor_champion_crowned_at <= period\.final_kickoff_at/i);
  assert.match(sql, /grant execute on function public\.eliminate_survivor_no_picks\(timestamptz\)\s+to service_role/i);
});

test("the one-time repair restores only a champion eliminated by the no-pick rule after the crown, behind the audited guard, and audits each entry", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261021030000_restore_champions_eliminated_after_crown.sql", import.meta.url), "utf8");
  assert.match(sql, /set_config\('app\.allow_survivor_score_correction', 'on', true\)/, "the guard is local to the transaction");
  assert.match(sql, /set_config\('app\.allow_survivor_score_correction', 'off', true\)/, "and is closed again");
  assert.match(sql, /championship\.pool = 'survivor'/);
  assert.match(sql, /entry\.eliminated_game_id is null/, "never a genuine loss");
  assert.match(sql, /entry\.eliminated_at > championship\.crowned_at/, "only after the crown");
  assert.match(sql, /audit\.action = 'survivor_no_pick_eliminated'/, "only what the no-pick rule did");
  assert.match(sql, /'survivor_champion_entry_restored'/, "each restored entry is audited");
});
