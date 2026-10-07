import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { parsePickSubmission, parseBowlSubmission } = await import("../src/lib/selection-submission.ts");
const { survivorChampionDisplayId } = await import("../src/lib/inaugural-survivor-holder.ts");

const validPick = { scoringPeriodId: "week-3", selections: [{ gameId: "game-1", teamId: "team-1" }] };
const validBowl = { optedIn: true, selections: [{ gameId: "bowl-1", teamId: "team-1" }] };

test("pick submissions reject malformed bodies and entries", () => {
  for (const input of [null, [], {}, { ...validPick, scoringPeriodId: 7 },
    { ...validPick, selections: [null] }, { ...validPick, selections: [{ gameId: "game-1" }] },
    { ...validPick, selections: [{ gameId: "game-1", teamId: 3 }] },
    { ...validPick, selections: [{ gameId: " game-1", teamId: "team-1" }] },
    { ...validPick, selections: Array.from({ length: 65 }, (_, index) => ({ gameId: `game-${index}`, teamId: "team-1" })) },
    { ...validPick, selections: [validPick.selections[0], validPick.selections[0]] },
  ]) assert.equal(parsePickSubmission(input).value, null);
  assert.match(parsePickSubmission({ ...validPick, selections: [validPick.selections[0], validPick.selections[0]] }).error, /one team/);
});

test("omitted Survivor, explicit clear, and valid choice remain distinct", () => {
  const omitted = parsePickSubmission(validPick).value;
  const cleared = parsePickSubmission({ scoringPeriodId: "week-3", selections: [], survivorSelection: null }).value;
  const chosen = parsePickSubmission({ ...validPick, survivorSelection: { gameId: "game-2", teamId: "team-2" } }).value;
  assert.equal(Object.hasOwn(omitted, "survivorSelection"), false);
  assert.equal(cleared.survivorSelection, null);
  assert.deepEqual(chosen.survivorSelection, { gameId: "game-2", teamId: "team-2" });
  for (const survivorSelection of [undefined, {}, { gameId: "game-2" }, { gameId: "game-2", teamId: null }]) {
    assert.equal(parsePickSubmission({ ...validPick, survivorSelection }).value, null);
  }
});

test("Bowl submissions accept known teams and commissioner placeholders, but not malformed values", () => {
  assert.deepEqual(parseBowlSubmission({ optedIn: false, selections: [] }).value,
    { optedIn: false, selections: [], championshipTotalGuess: null });
  assert.deepEqual(parseBowlSubmission({ optedIn: false, selections: [null], championshipTotalGuess: "unfinished" }).value,
    { optedIn: false, selections: [], championshipTotalGuess: null });
  assert.equal(parseBowlSubmission({ ...validBowl, championshipTotalGuess: 0 }).value.championshipTotalGuess, 0);
  assert.equal(parseBowlSubmission({ ...validBowl, championshipTotalGuess: 200 }).value.championshipTotalGuess, 200);
  assert.deepEqual(parseBowlSubmission({ optedIn: true, selections: [{ gameId: "bowl-1", teamId: "", side: "favorite" }] }).value?.selections,
    [{ gameId: "bowl-1", teamId: "", side: "favorite" }]);
  for (const input of [null, {}, { ...validBowl, optedIn: "true" },
    { ...validBowl, selections: [null] }, { ...validBowl, selections: [{ gameId: "bowl-1" }] },
    { ...validBowl, selections: [validBowl.selections[0], validBowl.selections[0]] },
    { ...validBowl, selections: Array.from({ length: 257 }, (_, index) => ({ gameId: `bowl-${index}`, teamId: "team-1" })) },
    ...[-1, 1.5, 201, "25", Infinity].map((championshipTotalGuess) => ({ ...validBowl, championshipTotalGuess })),
  ]) assert.equal(parseBowlSubmission(input).value, null);
});

test("the inaugural Survivor champion is shown only in the uncrowned launch season, from the recorded history", () => {
  const activePlayers = [{ id: "john-id" }, { id: "dana-id" }];
  const history = [{ player_id: "john-id", pool: "survivor", season_year: 2025 }, { player_id: "dana-id", pool: "pickem", season_year: 2025 }];
  const displayId = (seasonYear, recordedChampionId = null, championships = history, players = activePlayers) => survivorChampionDisplayId({ seasonYear, recordedChampionId, championships, activePlayers: players });
  // Launch season, no champion yet: the recorded 2025 Survivor champion.
  assert.equal(displayId(2026), "john-id");
  // Later seasons never fall back to anyone.
  assert.equal(displayId(2027), null);
  assert.equal(displayId(2025), null);
  // A crowned season shows its own champion, whatever the history says.
  assert.equal(displayId(2027, "winner-id"), "winner-id");
  assert.equal(displayId(2026, "winner-id"), "winner-id");
  // No name matching: a player called John with no recorded championship is not the holder.
  assert.equal(displayId(2026, null, [{ player_id: "dana-id", pool: "pickem", season_year: 2025 }], [{ id: "johnny" }]), null);
  // The Pick'em champion of 2025 is not the Survivor holder, and an inactive or absent holder shows no one.
  assert.equal(displayId(2026, null, [{ player_id: "dana-id", pool: "pickem", season_year: 2025 }]), null);
  assert.equal(displayId(2026, null, history, [{ id: "dana-id" }]), null);
  assert.equal(displayId(2026, null, []), null);
  // Co-champions in 2025: the first one who is still active.
  const co = [{ player_id: "gone-id", pool: "survivor", season_year: 2025 }, { player_id: "john-id", pool: "survivor", season_year: 2025 }];
  assert.equal(displayId(2026, null, co), "john-id");
});
