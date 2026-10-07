import assert from "node:assert/strict";
import test from "node:test";
import { selectLineLockDecisions } from "../src/lib/line-lock-decisions.js";

const checkedAt = "2026-10-04T16:00:00.000Z";
const game = {
  id: "game-1",
  odds_event_id: "event-1",
  away_team_id: "away",
  home_team_id: "home",
};

function input(overrides = {}) {
  return {
    dueGames: [game],
    oddsEvents: [],
    latestHistoryByGameId: new Map(),
    teamNameById: new Map([
      ["away", "Away Team"],
      ["home", "Home Team"],
    ]),
    teamIdByName: new Map([
      ["Away Team", "away"],
      ["Home Team", "home"],
    ]),
    checkedAt,
    ...overrides,
  };
}

function event(outcomes, bookmaker = "draftkings") {
  return {
    id: "event-1",
    bookmakers: [{ key: bookmaker, markets: [{ key: "spreads", outcomes }] }],
  };
}

test("a live DraftKings favorite becomes a history-recording official line", () => {
  const result = selectLineLockDecisions(input({
    oddsEvents: [event([
      { name: "Away Team", point: -3.5 },
      { name: "Home Team", point: 3.5 },
    ])],
  }));
  assert.deepEqual(result, {
    decisions: [{
      gameId: "game-1",
      favoriteTeamId: "away",
      spread: 3.5,
      source: "DraftKings",
      sourceCapturedAt: checkedAt,
      usedFallback: false,
      wasPickEm: false,
      recordHistory: true,
    }],
    missingGames: [],
    warnings: [],
  });
});

test("a live zero spread preserves the home-team Pick'em convention", () => {
  const result = selectLineLockDecisions(input({
    oddsEvents: [event([
      { name: "Away Team", point: 0 },
      { name: "Home Team", point: 0 },
    ])],
  }));
  assert.equal(result.decisions[0].favoriteTeamId, "home");
  assert.equal(result.decisions[0].spread, 0);
  assert.equal(result.decisions[0].wasPickEm, true);
  assert.equal(result.decisions[0].recordHistory, true);
});

test("an unusable live market uses a fresh saved line without new history", () => {
  const result = selectLineLockDecisions(input({
    oddsEvents: [event([{ name: "Unknown Team", point: -2 }])],
    latestHistoryByGameId: new Map([["game-1", {
      favorite_team_id: "home",
      spread: "1.5",
      source: "Saved market",
      captured_at: "2026-10-03T16:00:00.000Z",
    }]]),
  }));
  assert.deepEqual(result.decisions, [{
    gameId: "game-1",
    favoriteTeamId: "home",
    spread: 1.5,
    source: "Saved market - last known",
    sourceCapturedAt: "2026-10-03T16:00:00.000Z",
    usedFallback: true,
    wasPickEm: false,
    recordHistory: false,
  }]);
  assert.deepEqual(result.missingGames, []);
});

test("a stale saved line is not locked and reports its age", () => {
  const result = selectLineLockDecisions(input({
    latestHistoryByGameId: new Map([["game-1", {
      favorite_team_id: "away",
      spread: 3,
      source: "Saved market",
      captured_at: "2026-10-03T15:00:00.000Z",
    }]]),
  }));
  assert.deepEqual(result.decisions, []);
  assert.deepEqual(result.missingGames, ["Away Team at Home Team"]);
  assert.match(result.warnings[0], /25 hours old.*Commissioner review is required/);
});

test("missing provider event and no saved line leave the game for review", () => {
  const result = selectLineLockDecisions(input());
  assert.deepEqual(result.decisions, []);
  assert.deepEqual(result.missingGames, ["Away Team at Home Team"]);
  assert.deepEqual(result.warnings, []);
});

test("other bookmakers do not become official DraftKings lines", () => {
  const result = selectLineLockDecisions(input({
    oddsEvents: [event([{ name: "Away Team", point: -7 }], "other")],
  }));
  assert.deepEqual(result.decisions, []);
  assert.deepEqual(result.missingGames, ["Away Team at Home Team"]);
});

test("a favorite from another matchup cannot lock this game's line", () => {
  const result = selectLineLockDecisions(input({
    teamIdByName: new Map([
      ["Away Team", "away"],
      ["Home Team", "home"],
      ["Other Team", "other"],
    ]),
    oddsEvents: [event([
      { name: "Other Team", point: -3 },
      { name: "Home Team", point: 3 },
    ])],
  }));
  assert.deepEqual(result.decisions, []);
  assert.deepEqual(result.missingGames, ["Away Team at Home Team"]);
});

test("a partial or mismatched opponent market is not a verified spread", () => {
  for (const outcomes of [
    [{ name: "Away Team", point: -3 }],
    [{ name: "Away Team", point: -3 }, { name: "Other Team", point: 3 }],
    [{ name: "Away Team", point: -3 }, { name: "Home Team", point: 4 }],
  ]) {
    const result = selectLineLockDecisions(input({ oddsEvents: [event(outcomes)] }));
    assert.deepEqual(result.decisions, []);
    assert.deepEqual(result.missingGames, ["Away Team at Home Team"]);
  }
});

test("a mismatched zero-spread market cannot become this game's PK line", () => {
  const result = selectLineLockDecisions(input({
    oddsEvents: [event([
      { name: "Other Team", point: 0 },
      { name: "Home Team", point: 0 },
    ])],
  }));
  assert.deepEqual(result.decisions, []);
  assert.deepEqual(result.missingGames, ["Away Team at Home Team"]);
});

test("non-finite provider points cannot become official lines", () => {
  const result = selectLineLockDecisions(input({
    oddsEvents: [event([
      { name: "Away Team", point: -Infinity },
      { name: "Home Team", point: Infinity },
    ])],
  }));
  assert.deepEqual(result.decisions, []);
});

test("invalid or mismatched fallback history is left for Commissioner review", () => {
  for (const previousLine of [
    { favorite_team_id: "away", spread: "not-a-number" },
    { favorite_team_id: "away", spread: "" },
    { favorite_team_id: "other", spread: 3 },
  ]) {
    const result = selectLineLockDecisions(input({
      latestHistoryByGameId: new Map([["game-1", {
        ...previousLine,
        source: "Saved market",
        captured_at: "2026-10-04T15:00:00.000Z",
      }]]),
    }));
    assert.deepEqual(result.decisions, []);
    assert.deepEqual(result.missingGames, ["Away Team at Home Team"]);
    assert.match(result.warnings[0], /invalid or did not match this game/);
  }
});
