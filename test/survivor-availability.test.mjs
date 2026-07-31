import assert from "node:assert/strict";
import test from "node:test";
import {
  isSurvivorSlateEditable,
  isSurvivorTeamUnavailable,
} from "../src/lib/survivor-availability.js";

test("keeps this week's saved Survivor pick selectable while choosing a replacement", () => {
  assert.equal(isSurvivorTeamUnavailable({
    teamId: "rams",
    usedTeamIds: ["bills", "rams"],
    savedPickTeamId: "rams",
    gameStarted: false,
    entryEliminated: false,
  }), false);
});

test("blocks teams used in prior Survivor weeks", () => {
  assert.equal(isSurvivorTeamUnavailable({
    teamId: "bills",
    usedTeamIds: ["bills", "rams"],
    savedPickTeamId: "rams",
    gameStarted: false,
    entryEliminated: false,
  }), true);
});

test("never permits a started matchup or eliminated entry", () => {
  assert.equal(isSurvivorTeamUnavailable({
    teamId: "rams",
    usedTeamIds: ["rams"],
    savedPickTeamId: "rams",
    gameStarted: true,
    entryEliminated: false,
  }), true);
  assert.equal(isSurvivorTeamUnavailable({
    teamId: "new-team",
    usedTeamIds: [],
    savedPickTeamId: null,
    gameStarted: false,
    entryEliminated: true,
  }), true);
});

test("only exposes Slate Survivor chips for an editable active regular-season entry", () => {
  const activeEntry = {
    periodType: "regular",
    periodStatus: "active",
    survivorAvailable: true,
    survivorStatus: "active",
    selectedGameKickoffAt: null,
    now: "2026-09-10T12:00:00Z",
  };

  assert.equal(isSurvivorSlateEditable(activeEntry), true);
  assert.equal(isSurvivorSlateEditable({ ...activeEntry, periodType: "playoff" }), false);
  assert.equal(isSurvivorSlateEditable({ ...activeEntry, periodStatus: "complete" }), false);
  assert.equal(isSurvivorSlateEditable({ ...activeEntry, survivorStatus: "eliminated" }), false);
  assert.equal(isSurvivorSlateEditable({ ...activeEntry, survivorAvailable: false }), false);
});

test("removes Survivor chips once the chosen matchup reaches kickoff", () => {
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
