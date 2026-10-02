import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isSurvivorSlateEditable,
  isSurvivorTeamUsed,
} from "../src/lib/survivor-availability.js";

test("keeps this week's saved Survivor pick choosable while picking a replacement", () => {
  assert.equal(isSurvivorTeamUsed({ teamId: "rams", usedTeamIds: ["bills", "rams"], selectedTeamId: "colts", savedTeamId: "rams" }), false);
});

test("allows a player to switch back after reconsidering an unsaved replacement", () => {
  // Bengals -> Colts -> Bengals before saving: the selection is never "used".
  assert.equal(isSurvivorTeamUsed({ teamId: "bengals", usedTeamIds: ["bengals"], selectedTeamId: "bengals", savedTeamId: null }), false);
});

test("blocks teams used in prior Survivor weeks", () => {
  assert.equal(isSurvivorTeamUsed({ teamId: "bills", usedTeamIds: ["bills", "rams"], selectedTeamId: null, savedTeamId: "rams" }), true);
  assert.equal(isSurvivorTeamUsed({ teamId: "jets", usedTeamIds: ["bills"], selectedTeamId: null, savedTeamId: null }), false);
});

test("the Slate uses the shared rule, and a started game is locked rather than unavailable", async () => {
  const row = await readFile(new URL("../src/components/slate-game-row.tsx", import.meta.url), "utf8");
  assert.match(row, /const survivorUsed = isSurvivorTeamUsed\(\{ teamId: team\.id, usedTeamIds: survivor\.usedTeamIds, selectedTeamId: survivor\.selectedTeamId, savedTeamId: survivor\.savedTeamId \}\);/);
  assert.match(row, /const survivorLocked = hasStarted \|\| !survivor\.interactive;/);
});

test("exposes Slate Survivor chips for an editable upcoming or active regular-season entry", () => {
  const activeEntry = {
    periodType: "regular",
    periodStatus: "active",
    survivorAvailable: true,
    survivorStatus: "active",
    selectedGameKickoffAt: null,
    now: "2026-09-10T12:00:00Z",
  };

  assert.equal(isSurvivorSlateEditable(activeEntry), true);
  assert.equal(isSurvivorSlateEditable({ ...activeEntry, periodStatus: "upcoming" }), true);
  assert.equal(isSurvivorSlateEditable({ ...activeEntry, periodType: "playoff" }), false);
  assert.equal(isSurvivorSlateEditable({ ...activeEntry, periodStatus: "complete" }), false);
  assert.equal(isSurvivorSlateEditable({ ...activeEntry, survivorStatus: "eliminated" }), false);
  assert.equal(isSurvivorSlateEditable({ ...activeEntry, survivorAvailable: false }), false);
});

test("stops Survivor selection once the chosen matchup reaches kickoff", () => {
  const activeEntry = {
    periodType: "regular",
    periodStatus: "active",
    survivorAvailable: true,
    survivorStatus: "active",
    now: "2026-09-10T12:00:00Z",
  };

  assert.equal(isSurvivorSlateEditable({
    ...activeEntry,
    selectedGameKickoffAt: "2026-09-10T11:59:59Z",
  }), false);
  assert.equal(isSurvivorSlateEditable({
    ...activeEntry,
    selectedGameKickoffAt: "2026-09-10T12:01:00Z",
  }), true);
});
