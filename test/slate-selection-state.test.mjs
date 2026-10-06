import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { initialSlateSelectionState, slateSelectionReducer } = await import("../src/lib/slate-selection-state.ts");

test("hydrating a week establishes matching drafts and saved picks", () => {
  const picks = [{ gameId: "game-1", teamId: "home" }];
  const survivorPick = { gameId: "game-2", teamId: "away" };
  const state = slateSelectionReducer(initialSlateSelectionState, { type: "hydrate", picks, survivorPick });

  assert.deepEqual(state, {
    selectedPicks: picks,
    savedPicks: picks,
    survivorPick,
    savedSurvivorPick: survivorPick,
  });
});

test("a completed request saves its submitted snapshot without erasing newer edits", () => {
  const submittedPicks = [{ gameId: "game-1", teamId: "away" }];
  const submittedSurvivorPick = { gameId: "game-2", teamId: "home" };
  let state = slateSelectionReducer(initialSlateSelectionState, {
    type: "hydrate",
    picks: [{ gameId: "game-1", teamId: "home" }],
    survivorPick: { gameId: "game-2", teamId: "away" },
  });
  state = slateSelectionReducer(state, { type: "choose-pick", gameId: "game-1", teamId: "away" });
  state = slateSelectionReducer(state, { type: "choose-survivor", pick: submittedSurvivorPick });

  state = slateSelectionReducer(state, {
    type: "choose-pick",
    gameId: "game-1",
    teamId: "home",
  });
  state = slateSelectionReducer(state, {
    type: "choose-survivor",
    pick: { gameId: "game-2", teamId: "away" },
  });
  state = slateSelectionReducer(state, {
    type: "save-succeeded",
    submittedPicks,
    submittedSurvivorPick,
  });

  assert.deepEqual(state.selectedPicks, [{ gameId: "game-1", teamId: "home" }]);
  assert.deepEqual(state.savedPicks, submittedPicks);
  assert.deepEqual(state.survivorPick, { gameId: "game-2", teamId: "away" });
  assert.deepEqual(state.savedSurvivorPick, submittedSurvivorPick);
});

test("a save that did not include Survivor leaves its saved pick untouched", () => {
  const survivorPick = { gameId: "game-2", teamId: "away" };
  const state = slateSelectionReducer({
    ...initialSlateSelectionState,
    survivorPick,
    savedSurvivorPick: survivorPick,
  }, {
    type: "save-succeeded",
    submittedPicks: [{ gameId: "game-1", teamId: "home" }],
  });

  assert.equal(state.savedSurvivorPick, survivorPick);
});
