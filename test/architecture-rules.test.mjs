import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Rules about how the code is put together, checked by reading it. These are lint-style on purpose: each says something that must hold for every
// route or module of a kind, which no single behavior test can show. A test of what a function DOES belongs beside that function and runs it.
// (AGENTS.md: never match the text of the stylesheet or of a component's markup; add a screenshot state instead.)
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Season Snapshot route checks sign-in before it reads anything, and reports the sign-in failure's own status", async () => {
  const route = await source("src/app/api/season-snapshot/route.ts");
  assert.ok(route.indexOf("authenticateActivePlayer(request)") >= 0 && route.indexOf("authenticateActivePlayer(request)") < route.indexOf("loadSeasonSnapshot("));
  assert.match(route, /status: access\.status/);
});

test("the browser's Sentry events pass through the shared filter before they are sent", async () => {
  assert.match(await source("instrumentation-client.ts"), /beforeSend:\s*prepareBrowserSentryEvent/);
});

test("the server credential is the service-role key first, the secret key only as a named fallback, and launch preflight rejects the fallback", async () => {
  const admin = await source("src/lib/supabase-admin.ts");
  const preflight = await source("src/lib/launch-preflight.ts");
  assert.ok(admin.indexOf("SUPABASE_SERVICE_ROLE_KEY") < admin.indexOf("SUPABASE_SECRET_KEY"));
  assert.match(admin, /supabaseServerCredentialSource/);
  assert.match(admin, /supabaseServerCredentialUsesFallback/);
  assert.match(preflight, /authorized && authoritativeSource/);
  assert.match(preflight, /compatibility fallback/);
});
