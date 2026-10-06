import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hook = await readFile(new URL("../src/lib/use-slate-board-data.ts", import.meta.url), "utf8");

test("Slate week reads remain bounded, cancellable, and latest-request-wins", () => {
  assert.match(hook, /const BOARD_LOAD_TIMEOUT_MS = 15_000/);
  assert.match(hook, /activeBoardRequest\.current\?\.abort\(\)/);
  assert.match(hook, /if \(requestId !== boardRequestId\.current\) return/);
  assert.match(hook, /boardRequestId\.current \+= 1;\s+activeBoardRequest\.current\?\.abort\(\)/);
});

test("Slate bootstrap is cancelled and its timeout is cleared on unmount", () => {
  assert.match(hook, /const requestTimer = window\.setTimeout\(\(\) => request\.abort\(\), BOARD_LOAD_TIMEOUT_MS\)/);
  assert.match(hook, /disposed = true;\s+window\.clearTimeout\(requestTimer\);\s+request\.abort\(\)/);
});

test("kickoff visibility refresh does not rehydrate player picks or preferences", () => {
  const refreshStart = hook.indexOf("const refreshPublicVisibility = async");
  const derivedStateStart = hook.indexOf("const availableWeeks = useMemo", refreshStart);
  assert.notEqual(refreshStart, -1);
  assert.notEqual(derivedStateStart, -1);
  const kickoffRefresh = hook.slice(refreshStart, derivedStateStart);

  assert.doesNotMatch(kickoffRefresh, /onBoardLoaded/);
  assert.match(kickoffRefresh, /signal: visibilityRequest\.signal/);
  assert.match(kickoffRefresh, /return \(\) => visibilityRequest\.abort\(\)/);
  assert.match(kickoffRefresh, /setGames\(data\.games\)/);
  assert.match(kickoffRefresh, /setPlayoffEliminated\(data\.pickem\.playoffEliminated\)/);
});

test("a successful explicit week reload clears that week's uncertain-save guard", async () => {
  const page = await readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const loaded = await loadWeek\(selectedWeek\);\s+if \(loaded\) \{\s+setSaveVerificationRequiredForPeriod\(\(current\) => current === selectedWeek\.id \? null : current\);/);
  assert.match(hook, /async function loadWeek\(period: ScoringPeriod\): Promise<boolean>/);
});
