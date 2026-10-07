import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { initialSlateState, slateReducer } = await import("../src/lib/slate-state.ts");

const period = (id, extra = {}) => ({ id, display_name: id, display_order: 1, status: "active", period_type: "regular", max_picks: 2, ...extra });
const game = (id, extra = {}) => ({ id, kickoffAt: "2026-10-04T20:25:00Z", awayTeamId: `${id}-a`, homeTeamId: `${id}-h`, ...extra });
const board = (extra = {}) => ({
  serverTime: "2026-10-04T17:00:00Z", games: [game("g1"), game("g2")], myPicks: [], pickem: { playoffEliminated: false },
  survivor: { available: true, chipsVisible: true, notice: null, status: "active", pick: null, usedTeamIds: [] }, showPoolAction: false, ...extra,
});
const run = (actions, start = initialSlateState) => actions.reduce(slateReducer, start);
const loaded = (extra = {}) => run([{ type: "bootstrap-loaded", loadId: 0, weeks: [period("w1")], nextWeekAvailableAt: null, week: period("w1"), board: board(extra) }, { type: "load-finished", loadId: 0 }]);

test("the first load fills every part from the server: draft and saved start equal", () => {
  const state = loaded({ myPicks: [{ gameId: "g1", teamId: "g1-h" }], survivor: { available: true, chipsVisible: true, status: "active", pick: { game_id: "g2", selected_team_id: "g2-a" }, usedTeamIds: ["x"] } });
  assert.deepEqual(state.draftPicks, state.savedPicks);
  assert.deepEqual(state.draftSurvivor, { gameId: "g2", teamId: "g2-a" });
  assert.deepEqual(state.savedSurvivor, state.draftSurvivor);
  assert.equal(state.isLoading, false);
  assert.equal(state.clockSynchronized, true);
  assert.deepEqual(state.survivorUsedTeamIds, ["x"]);
});

test("out-of-order reads: a slower, older week can never replace a newer one", () => {
  let state = loaded();
  state = run([{ type: "load-started", loadId: 1, week: period("w2") }, { type: "load-started", loadId: 2, week: period("w3") }], state);
  // Week 3 answers first; week 2's slow answer arrives afterwards and must be ignored.
  state = run([{ type: "board-loaded", loadId: 2, board: board({ games: [game("w3-g")] }) }, { type: "board-loaded", loadId: 1, board: board({ games: [game("w2-g")] }) }, { type: "load-finished", loadId: 2 }, { type: "load-finished", loadId: 1 }], state);
  assert.deepEqual(state.games.map((item) => item.id), ["w3-g"]);
  assert.equal(state.week.id, "w3");
  assert.equal(state.isLoading, false);
});

test("rapid week switching: only the last switch ends the loading state, and a stale failure is ignored", () => {
  let state = loaded();
  state = run([{ type: "load-started", loadId: 1, week: period("w2") }, { type: "load-started", loadId: 2, week: period("w3") }, { type: "load-failed", loadId: 1, message: "old error" }, { type: "load-finished", loadId: 1 }], state);
  assert.equal(state.errorMessage, "");
  assert.equal(state.isLoading, true, "week 1's end does not finish week 2's load");
  state = run([{ type: "load-failed", loadId: 2, message: "current error" }, { type: "load-finished", loadId: 2 }], state);
  assert.equal(state.errorMessage, "current error");
  assert.equal(state.isLoading, false);
});

test("editing during a refresh: a kickoff refresh replaces the games but never the draft or saved picks", () => {
  let state = loaded({ myPicks: [{ gameId: "g1", teamId: "g1-h" }] });
  state = run([{ type: "pick-added", gameId: "g2", teamId: "g2-a" }], state);
  state = run([{ type: "kickoff-refreshed", loadId: 0, board: board({ games: [game("g1", { homePickers: ["Dana"] }), game("g2")], myPicks: [] }) }], state);
  assert.deepEqual(state.draftPicks, [{ gameId: "g1", teamId: "g1-h" }, { gameId: "g2", teamId: "g2-a" }], "the unsaved pick survives");
  assert.deepEqual(state.savedPicks, [{ gameId: "g1", teamId: "g1-h" }]);
  assert.deepEqual(state.games[0].homePickers, ["Dana"], "the public picks do appear");
  // A refresh that belongs to an old week is dropped.
  const stale = run([{ type: "load-started", loadId: 1, week: period("w2") }, { type: "kickoff-refreshed", loadId: 0, board: board({ games: [game("old")] }) }], state);
  assert.notDeepEqual(stale.games.map((item) => item.id), ["old"]);
});

test("kickoff crossing: an unsaved pick on a started game is discarded with a notice, the saved one stays", () => {
  let state = loaded({ myPicks: [{ gameId: "g1", teamId: "g1-h" }] });
  state = run([{ type: "pick-added", gameId: "g2", teamId: "g2-a" }], state);
  state = run([{ type: "draft-reconciled", picks: [{ gameId: "g1", teamId: "g1-h" }], survivor: null, warning: "Kickoff passed. Unsaved changes for that game were discarded; submitted picks remain sealed." }], state);
  assert.deepEqual(state.draftPicks, [{ gameId: "g1", teamId: "g1-h" }]);
  assert.match(state.warning, /Kickoff passed/);
  // Reconciling the Survivor draft alone changes nothing else.
  const survivor = run([{ type: "survivor-chosen", pick: { gameId: "g2", teamId: "g2-a" } }, { type: "draft-reconciled", picks: null, survivor: { pick: null }, warning: null }], loaded());
  assert.equal(survivor.draftSurvivor, null);
  assert.deepEqual(survivor.draftPicks, []);
});

test("a save records the picks that were sent, so an edit made while it was in flight stays unsaved", () => {
  let state = loaded();
  state = run([{ type: "pick-added", gameId: "g1", teamId: "g1-h" }, { type: "submit-started" }], state);
  const sent = state.draftPicks;
  state = run([{ type: "pick-added", gameId: "g2", teamId: "g2-a" }], state); // edited while saving
  state = run([{ type: "submit-succeeded", picks: sent, survivor: null }], state);
  assert.deepEqual(state.savedPicks, [{ gameId: "g1", teamId: "g1-h" }]);
  assert.equal(state.draftPicks.length, 2, "the newer edit is still a draft");
  assert.equal(state.isSubmitting, false);
});

test("a failed save keeps the draft, shows the reason, and allows another try", () => {
  let state = loaded();
  state = run([{ type: "pick-added", gameId: "g1", teamId: "g1-h" }, { type: "submit-started" }, { type: "submit-failed", message: "Your picks could not be saved." }], state);
  assert.equal(state.isSubmitting, false);
  assert.equal(state.warning, "Your picks could not be saved.");
  assert.deepEqual(state.draftPicks, [{ gameId: "g1", teamId: "g1-h" }]);
  assert.deepEqual(state.savedPicks, []);
});

test("a save that committed before its response was lost: reading the server settles the saved picks without touching the draft", () => {
  let state = loaded();
  state = run([{ type: "pick-added", gameId: "g1", teamId: "g1-h" }, { type: "submit-started" }, { type: "submit-failed", message: "taking too long" }], state);
  assert.deepEqual(state.savedPicks, []);
  // The follow-up read shows the server did save the picks.
  state = run([{ type: "saved-state-read", loadId: 0, board: board({ myPicks: [{ gameId: "g1", teamId: "g1-h" }] }) }], state);
  assert.deepEqual(state.savedPicks, state.draftPicks, "nothing is left unsaved, so no duplicate submission is offered");
});

test("choosing and removing: the sweep highlight follows a choice, and clears when the same team is chosen again", () => {
  let state = run([{ type: "pick-added", gameId: "g1", teamId: "g1-h" }], loaded());
  assert.deepEqual(state.feedback, { gameId: "g1", teamId: "g1-h", type: "sweep", token: 1 });
  state = run([{ type: "pick-removed", gameId: "g1", clearFeedback: false }], state);
  assert.notEqual(state.feedback, null, "removing from the receipt leaves the highlight");
  state = run([{ type: "pick-added", gameId: "g2", teamId: "g2-a" }, { type: "pick-removed", gameId: "g2", clearFeedback: true }], state);
  assert.equal(state.feedback, null);
  assert.equal(state.feedbackToken, 2);
});

test("the season phase only changes when a response carries it", () => {
  assert.equal(loaded().seasonOver, false);
  const closed = run([{ type: "board-loaded", loadId: 0, board: board({ seasonPhase: "off_season" }) }], loaded());
  assert.equal(closed.seasonOver, true);
  assert.equal(run([{ type: "board-loaded", loadId: 0, board: board() }], closed).seasonOver, true, "a response without a phase leaves it as it was");
});
