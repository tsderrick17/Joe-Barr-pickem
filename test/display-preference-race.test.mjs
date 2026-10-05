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

test("the gap under the Survivor heading rolls with the table, so nothing below jumps when the roll ends", async () => {
  const { readStylesheet } = await import("./helpers/stylesheet.mjs");
  const css = await readStylesheet();
  assert.match(css, /\.survivor-ledger \.survivor-ledger-masthead \{ margin-bottom: 0; \}/);
  assert.match(css, /\.survivor-ledger \.slide-section \{ display: flow-root; \}/);
  assert.match(css, /\.survivor-ledger \.slide-section > \* \{ margin-top: \.55rem; \}/);
  assert.match(css, /@media \(min-width: 640px\) \{\s*\.survivor-ledger \.slide-section > \* \{ margin-top: \.7rem; \}/);
});

test("the Standings page waits for the Bowl Card's first load, so the card never pops in late", async () => {
  const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const card = await readFile(new URL("../src/components/bowl-card.tsx", import.meta.url), "utf8");
  // The card reports when its first load ends, whether it worked or not.
  assert.match(card, /\.catch\(\(\) => undefined\)\.finally\(\(\) => onReady\?\.\(\)\)/);
  // The page keeps the loading shell up, with the page laid out but hidden beneath it, until then, with a short time limit.
  assert.match(page, /\{bowlReady \? null : <StandingsLoadingShell \/>\}/);
  assert.match(page, /onReady=\{markBowlReady\}/);
  assert.match(page, /window\.setTimeout\(\(\) => setBowlReady\(true\), 2500\)/);
});

test("rolling rows away takes their borders back smoothly, so nothing below jumps when the roll ends", async () => {
  const source = await readFile(new URL("../src/components/collapse.tsx", import.meta.url), "utf8");
  // A border under a pixel is drawn as a whole pixel, so the roll uses a negative margin instead.
  assert.match(source, /marginBottom: `\$\{-border\}px`/);
  assert.doesNotMatch(source, /borderBottomWidth: "0px"/);
  // The row above the rolled rows, which loses its border when it becomes the last row, is handled the same way
  // and released once the rows have left the page.
  assert.match(source, /holding\.current = animations;/);
  assert.match(source, /for \(const animation of holding\.current\) animation\.cancel\(\);/);
});
