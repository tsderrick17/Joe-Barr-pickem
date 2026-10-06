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

test("only the uncrowned launch season uses the inaugural holder display fallback", () => {
  const activePlayers = [{ id: "john-id", first_name: " John " }, { id: "other-id", first_name: "Dana" }];
  const displayId = (seasonYear, recordedChampionId = null, players = activePlayers) => survivorChampionDisplayId({ seasonYear, recordedChampionId, activePlayers: players });
  assert.equal(displayId(2026), "john-id");
  assert.equal(displayId(2027), null);
  assert.equal(displayId(2027, "winner-id"), "winner-id");
  assert.equal(displayId(2026, "winner-id"), "winner-id");
  assert.equal(displayId(2026, null, [{ id: "not-john", first_name: "Johnny" }]), null);
});
