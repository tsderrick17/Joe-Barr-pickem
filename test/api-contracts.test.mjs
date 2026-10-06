import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { survivorEntryStatus } = await import("../src/lib/api-contracts.ts");

test("known Survivor entry states retain their API meaning", () => {
  for (const status of ["active", "eliminated", "complete"]) {
    assert.equal(survivorEntryStatus(status), status);
  }
});

test("an unmodelled Survivor state cannot silently display as a familiar one", () => {
  assert.throws(() => survivorEntryStatus("paused"), /unsupported status/);
});
