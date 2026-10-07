import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { initialSlateState, slateReducer } = await import("../src/lib/slate-state.ts");

const period = (id) => ({ id, display_name: id, display_order: 1, status: "active", period_type: "regular", max_picks: 2 });
const board = (showPoolAction) => ({
  serverTime: "2026-10-04T17:00:00Z", games: [], myPicks: [], pickem: { playoffEliminated: false },
  survivor: { available: true, chipsVisible: true, notice: null, status: "active", pick: null, usedTeamIds: [] }, showPoolAction,
});

test("Slate hydrates the per-player Pool Action preference on the first load and on every week change", () => {
  const first = slateReducer(initialSlateState, { type: "bootstrap-loaded", loadId: 0, weeks: [period("w1")], nextWeekAvailableAt: null, week: period("w1"), board: board(true) });
  assert.equal(first.showActionOnly, true);
  let state = slateReducer(first, { type: "load-started", loadId: 1, week: period("w2") });
  state = slateReducer(state, { type: "board-loaded", loadId: 1, board: board(false) });
  assert.equal(state.showActionOnly, false, "a week change takes the saved choice from the response too");
  state = slateReducer(state, { type: "load-started", loadId: 2, week: period("w3") });
  assert.equal(slateReducer(state, { type: "board-loaded", loadId: 2, board: board(true) }).showActionOnly, true);
});
