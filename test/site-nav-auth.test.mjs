import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("account navigation uses the shared authenticated profile path", async () => {
  const nav = await readFile(new URL("../src/components/site-nav.tsx", import.meta.url), "utf8");
  const profile = await readFile(new URL("../src/app/api/profile/route.ts", import.meta.url), "utf8");

  assert.match(nav, /fetchWithSession\("\/api\/profile"\)/);
  assert.match(nav, /SessionUnavailableError/);
  assert.match(nav, /response\.status === 401/);
  assert.match(nav, /router\.replace\("\/login"\)/);
  assert.doesNotMatch(nav, /supabase\s*\.from\("players"\)/);
  assert.match(profile, /firstName:\s*player\.first_name/);
  assert.match(profile, /isCommissioner:\s*player\.is_commissioner/);
});
