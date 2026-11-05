import assert from "node:assert/strict";
import test from "node:test";
import { howItWorksStart } from "../src/lib/how-it-works.js";

test("players outside the preview keep the classic instructions", () => {
  assert.equal(howItWorksStart({ preview: false, familiar: false }), null);
  assert.equal(howItWorksStart({ preview: false, familiar: true }), null);
});

test("a new player starts open and a familiar player starts folded", () => {
  assert.equal(howItWorksStart({ preview: true, familiar: false }), "open");
  assert.equal(howItWorksStart({ preview: true, familiar: true }), "folded");
});
