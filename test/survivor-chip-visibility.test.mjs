import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowSurvivorSlateChips } from "../src/lib/survivor-chip-visibility.js";

test("removes Survivor chips immediately when a champion is crowned", () => {
  assert.equal(shouldShowSurvivorSlateChips({
    periodType: "regular",
    championCrownedAt: "2026-12-22T03:30:00Z", // Dec. 21 ET
    now: "2026-12-22T04:59:59Z", // still Dec. 21 ET
  }), false);
});

test("keeps Survivor chips retired after the championship day", () => {
  assert.equal(shouldShowSurvivorSlateChips({
    periodType: "regular",
    championCrownedAt: "2026-12-22T03:30:00Z", // Dec. 21 ET
    now: "2026-12-22T05:00:00Z", // Dec. 22 ET
  }), false);
});

test("never exposes Survivor chips in the playoffs", () => {
  assert.equal(shouldShowSurvivorSlateChips({
    periodType: "playoff",
    championCrownedAt: null,
    now: "2027-01-10T12:00:00Z",
  }), false);
});
