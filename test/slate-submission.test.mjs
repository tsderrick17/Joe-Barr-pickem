import assert from "node:assert/strict";
import test from "node:test";
import {
  reconcileAtsDraftAtKickoff,
  reconcileSurvivorDraftAtKickoff,
} from "../src/lib/slate-draft-locks.js";
import { prepareAtsReplacements } from "../src/lib/slate-submission.js";

const games = [
  { id: "early", away_team_id: "a", home_team_id: "b", kickoff_at: "2026-09-13T17:00:00Z" },
  { id: "late", away_team_id: "c", home_team_id: "d", kickoff_at: "2026-09-13T20:00:00Z" },
];
const now = new Date("2026-09-13T18:00:00Z");

test("preserves a matching locked pick while replacing a later pick", () => {
  const result = prepareAtsReplacements({
    selections: [{ gameId: "early", teamId: "a" }, { gameId: "late", teamId: "d" }],
    existingPicks: [{ game_id: "early", selected_team_id: "a" }, { game_id: "late", selected_team_id: "c" }],
    games,
    now,
  });

  assert.deepEqual(result, { replacements: [{ game_id: "late", selected_team_id: "d" }] });
});

test("rejects changing or removing a locked pick", () => {
  const changed = prepareAtsReplacements({
    selections: [{ gameId: "early", teamId: "b" }],
    existingPicks: [{ game_id: "early", selected_team_id: "a" }],
    games,
    now,
  });
  assert.match(changed.error, /already started/);

  const removed = prepareAtsReplacements({
    selections: [],
    existingPicks: [{ game_id: "early", selected_team_id: "a" }],
    games,
    now,
  });
  assert.match(removed.error, /cannot be changed or removed/);
});

test("rejects a team that is not in its selected game", () => {
  const result = prepareAtsReplacements({
    selections: [{ gameId: "late", teamId: "a" }],
    existingPicks: [],
    games,
    now,
  });
  assert.match(result.error, /does not belong/);
});

test("treats kickoff as locked and never replaces the existing selection", () => {
  const result = prepareAtsReplacements({
    selections: [{ gameId: "early", teamId: "a" }],
    existingPicks: [{ game_id: "early", selected_team_id: "a" }],
    games,
    now: new Date("2026-09-13T17:00:00Z"),
  });

  assert.deepEqual(result, { replacements: [] });
});

test("rejects adding a selection once that game reaches kickoff", () => {
  const result = prepareAtsReplacements({
    selections: [{ gameId: "early", teamId: "a" }],
    existingPicks: [],
    games,
    now: new Date("2026-09-13T17:00:00Z"),
  });

  assert.match(result.error, /already started/);
});

test("preserves a partially locked six-game playoff ticket while replacing only future picks", () => {
  const playoffGames = Array.from({ length: 6 }, (_, index) => ({
    id: `playoff-${index + 1}`,
    away_team_id: `away-${index + 1}`,
    home_team_id: `home-${index + 1}`,
    kickoff_at: index < 2 ? "2027-01-16T18:00:00Z" : "2027-01-17T18:00:00Z",
  }));
  const existingPicks = playoffGames.map((game) => ({
    game_id: game.id,
    selected_team_id: game.away_team_id,
  }));
  const selections = playoffGames.map((game, index) => ({
    gameId: game.id,
    teamId: index === 4 ? game.home_team_id : game.away_team_id,
  }));

  const result = prepareAtsReplacements({
    selections,
    existingPicks,
    games: playoffGames,
    now: new Date("2027-01-16T20:00:00Z"),
  });

  assert.deepEqual(result, {
    replacements: [
      { game_id: "playoff-3", selected_team_id: "away-3" },
      { game_id: "playoff-4", selected_team_id: "away-4" },
      { game_id: "playoff-5", selected_team_id: "home-5" },
      { game_id: "playoff-6", selected_team_id: "away-6" },
    ],
  });
});

test("reconciles a six-game browser draft as individual games lock", () => {
  const playoffGames = Array.from({ length: 6 }, (_, index) => ({
    id: `playoff-${index + 1}`,
    kickoffAt: index < 2 ? "2027-01-16T18:00:00Z" : "2027-01-17T18:00:00Z",
  }));
  const savedPicks = playoffGames.map((game) => ({ gameId: game.id, teamId: `saved-${game.id}` }));
  const selections = playoffGames.map((game, index) => ({
    gameId: game.id,
    teamId: index === 0 || index === 4 ? `draft-${game.id}` : `saved-${game.id}`,
  }));

  const result = reconcileAtsDraftAtKickoff({
    games: playoffGames,
    selections,
    savedPicks,
    now: new Date("2027-01-16T20:00:00Z"),
  });

  assert.equal(result.changed, true);
  assert.equal(result.selections[0].teamId, "saved-playoff-1");
  assert.equal(result.selections[4].teamId, "draft-playoff-5");
});

test("restores a submitted Survivor pick when its game kicks off during an unsaved replacement", () => {
  const savedPick = { gameId: "early", teamId: "a" };
  const result = reconcileSurvivorDraftAtKickoff({
    games: [
      { id: "early", kickoffAt: "2026-09-13T17:00:00Z" },
      { id: "late", kickoffAt: "2026-09-13T20:00:00Z" },
    ],
    selection: { gameId: "late", teamId: "d" },
    savedPick,
    now: new Date("2026-09-13T18:00:00Z"),
  });

  assert.deepEqual(result, { selection: savedPick, changed: true });
});

test("keeps a Survivor replacement editable while the submitted game remains open", () => {
  const selection = { gameId: "late", teamId: "d" };
  const result = reconcileSurvivorDraftAtKickoff({
    games: [
      { id: "early", kickoffAt: "2026-09-13T17:00:00Z" },
      { id: "late", kickoffAt: "2026-09-13T20:00:00Z" },
    ],
    selection,
    savedPick: { gameId: "early", teamId: "a" },
    now: new Date("2026-09-13T16:00:00Z"),
  });

  assert.deepEqual(result, { selection, changed: false });
});

test("restores a submitted Survivor pick when the unsaved replacement kicks first", () => {
  const savedPick = { gameId: "late", teamId: "d" };
  const result = reconcileSurvivorDraftAtKickoff({
    games: [
      { id: "early", kickoffAt: "2026-09-13T17:00:00Z" },
      { id: "late", kickoffAt: "2026-09-13T20:00:00Z" },
    ],
    selection: { gameId: "early", teamId: "a" },
    savedPick,
    now: new Date("2026-09-13T18:00:00Z"),
  });

  assert.deepEqual(result, { selection: savedPick, changed: true });
});

test("clears an unsubmitted Survivor pick when its game kicks off", () => {
  const result = reconcileSurvivorDraftAtKickoff({
    games: [{ id: "early", kickoffAt: "2026-09-13T17:00:00Z" }],
    selection: { gameId: "early", teamId: "a" },
    savedPick: null,
    now: new Date("2026-09-13T17:00:00Z"),
  });

  assert.deepEqual(result, { selection: null, changed: true });
});
