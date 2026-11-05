import assert from "node:assert/strict";
import test from "node:test";
import { deploymentIdFor } from "../src/lib/deployment-id.js";

test("the deployment id is a short piece of the commit that Vercel accepts, and none outside Vercel", () => {
  const commit = "1599124ec21a098ffeff485c63827014602e08c6";
  assert.equal(commit.length, 40);
  const id = deploymentIdFor(commit);
  assert.ok(id && id.length <= 32, "Vercel refuses an id over 32 characters");
  assert.equal(id, "1599124ec21a");
  assert.notEqual(deploymentIdFor("2599124ec21a098ffeff485c63827014602e08c6"), id, "each commit has its own id");
  assert.equal(deploymentIdFor(undefined), undefined);
  assert.equal(deploymentIdFor(""), undefined);
  assert.equal(deploymentIdFor("  "), undefined);
});
