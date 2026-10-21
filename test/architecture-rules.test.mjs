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
