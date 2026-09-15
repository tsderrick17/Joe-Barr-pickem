import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("npm install scripts are explicitly approved and pinned", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(packageJson.allowScripts, {
    "@sentry/cli@2.58.6": true,
    "unrs-resolver@1.12.2": true,
  });
});
