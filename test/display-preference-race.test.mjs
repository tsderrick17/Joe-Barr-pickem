import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home display toggles preserve a saved preference over stale refresh data", async () => {
  const source = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /displayPreferenceOverrides = useRef/);
  assert.match(source, /const effectiveResult = \{[\s\S]*displayPreferenceOverrides\.current/);
  assert.match(source, /displayPreferenceOverrides\.current\.showSurvivorStandings = show/);
  assert.match(source, /displayPreferenceOverrides\.current\[pool === "pickem" \? "hidePickemEliminatedRows" : "hideSurvivorEliminatedRows"\] = hidden/);
});
