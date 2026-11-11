import assert from "node:assert/strict";
import test from "node:test";
import { howItWorksStart } from "../src/lib/how-it-works.js";

test("a new player starts open and a familiar player starts folded", () => {
  assert.equal(howItWorksStart({ familiar: false }), "open");
  assert.equal(howItWorksStart({ familiar: true }), "folded");
});
