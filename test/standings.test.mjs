import assert from "node:assert/strict";
import test from "node:test";
import { countPickemWins } from "../src/lib/standings.js";

test("counts only explicitly graded ATS wins in the standings", () => {
  assert.equal(
    countPickemWins([
      { result: "win" },
      { result: "loss" },
      { result: "pending" },
      { result: "void" },
      { result: "win" },
    ]),
    2,
  );
});

test("does not award a win for an ungraded or missing pick", () => {
  assert.equal(countPickemWins([{ result: "pending" }, null, {}]), 0);
});
