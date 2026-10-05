import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home display toggles preserve a saved preference over stale refresh data", async () => {
  const source = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /displayPreferenceOverrides = useRef/);
  assert.match(source, /const effectiveResult = \{[\s\S]*displayPreferenceOverrides\.current/);
  // One helper saves every display choice; all three toggles go through it.
  assert.match(source, /await saveDisplayChoice\("showSurvivorStandings", show, apply, !show\)/);
  assert.match(source, /await saveDisplayChoice\("showBowlCard", show, apply, !show\)/);
  assert.match(source, /await saveDisplayChoice\(field, hidden, apply, !hidden\)/);
  const helper = source.slice(source.indexOf("async function saveDisplayChoice"), source.indexOf("async function setSurvivorDisplay"));
  // The choice is remembered, then shown, before the save is sent, so a refresh that lands first cannot undo it
  // and the table starts rolling at once.
  const remembered = helper.indexOf("displayPreferenceOverrides.current[field] = value;");
  const shown = helper.indexOf("apply(value);");
  const sent = helper.indexOf("fetchWithSession");
  assert.ok(remembered >= 0 && remembered < shown && shown < sent, "remember, show, then save");
  // A failed save puts the old choice back, in the page and in the remembered overrides.
  assert.match(helper, /displayPreferenceOverrides\.current\[field\] = previous;\s*apply\(previous\);/);
  // The in-flight guard is a ref: a state flag redrew the page twice in the middle of the roll.
  assert.match(source, /const displaySaveInFlight = useRef\(false\);/);
  assert.doesNotMatch(source, /setSavingDisplay/);
});
