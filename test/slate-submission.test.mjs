import assert from "node:assert/strict";
import test from "node:test";
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
