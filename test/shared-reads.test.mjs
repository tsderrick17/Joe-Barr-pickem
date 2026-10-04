import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("identical plain API reads share one request, saves clear the kept profile, and sign-in changes clear everything", async () => {
  const source = await readFile(new URL("../src/lib/auth-session.ts", import.meta.url), "utf8");
  // Only plain reads are shared: never a save, never a cancellable request.
  assert.match(source, /!isReadRequest\(init\) \|\| init\.signal/);
  // Only the profile is kept after it settles, and only briefly.
  assert.match(source, /KEPT_READ_PATHS = new Set\(\["\/api\/profile"\]\)/);
  assert.match(source, /KEPT_READ_TTL_MS = 15_000/);
  // A successful save to the same path drops the shared copy.
  assert.match(source, /!isReadRequest\(init\) && result\.ok\) forgetSharedReads\(input\)/);
  // Another player signing in must never see the last player's reads.
  assert.match(source, /onAuthStateChange\(\(\) => sharedReads\.clear\(\)\)/);
});
