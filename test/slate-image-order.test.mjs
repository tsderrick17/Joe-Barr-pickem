import assert from "node:assert/strict";
import test from "node:test";
import { slateImagePresentation } from "../src/lib/slate-image-order.ts";

test("slate email images put the favorite on the left with only the spread centered", () => {
  assert.deepEqual(
    slateImagePresentation({ away: "Bears", home: "Jaguars", favorite: "home", spread: 2.5 }),
    { leftTeam: "Jaguars", line: "-2.5", rightTeam: "Bears" },
  );
  assert.deepEqual(
    slateImagePresentation({ away: "Chiefs", home: "Bills", favorite: "away", spread: 3 }),
    { leftTeam: "Chiefs", line: "-3", rightTeam: "Bills" },
  );
});

test("slate email images put the home team on the left for PK games", () => {
  assert.deepEqual(
    slateImagePresentation({ away: "Rams", home: "49ers", favorite: "away", spread: 0 }),
    { leftTeam: "49ers", line: "PK", rightTeam: "Rams" },
  );
});

test("slate email images preserve a clear pending state without inventing a favorite", () => {
  assert.deepEqual(
    slateImagePresentation({ away: "Packers", home: "Lions", favorite: null, spread: null }),
    { leftTeam: "Packers", line: "LINE PENDING", rightTeam: "Lions" },
  );
});
