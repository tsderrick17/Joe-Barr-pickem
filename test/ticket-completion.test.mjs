import assert from "node:assert/strict";
import test from "node:test";
import { ticketCompletion } from "../src/lib/ticket-completion.js";

test("counts active Pick'em and Survivor selections together", () => {
  assert.deepEqual(
    ticketCompletion({
      maxPicks: 2,
      pickemSelections: 2,
      survivorAvailable: true,
      survivorPickMade: true,
      survivorStatus: "active",
    }),
    { requiredSelections: 3, selectionsMade: 3, isFilled: true },
  );
});

test("keeps an active Survivor player open until the weekly Survivor pick is made", () => {
  assert.deepEqual(
    ticketCompletion({
      maxPicks: 2,
      pickemSelections: 2,
      survivorAvailable: true,
      survivorPickMade: false,
      survivorStatus: "active",
    }),
    { requiredSelections: 3, selectionsMade: 2, isFilled: false },
  );
});

test("removes Survivor from the ticket requirement once a player is out or the pool is complete", () => {
  for (const survivorStatus of ["eliminated", "complete"]) {
    assert.deepEqual(
      ticketCompletion({
        maxPicks: 2,
        pickemSelections: 2,
        survivorAvailable: true,
        survivorPickMade: true,
        survivorStatus,
      }),
      { requiredSelections: 2, selectionsMade: 2, isFilled: true },
    );
  }
});

test("treats a playoff ticket as Pick'em-only even if stale Survivor data is present", () => {
  assert.deepEqual(
    ticketCompletion({
      isPlayoff: true,
      maxPicks: 6,
      pickemSelections: 6,
      survivorAvailable: true,
      survivorPickMade: false,
      survivorStatus: "active",
    }),
    { requiredSelections: 6, selectionsMade: 6, isFilled: true },
  );
});
